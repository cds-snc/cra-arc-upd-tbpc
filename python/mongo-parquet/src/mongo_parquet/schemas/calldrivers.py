from datetime import datetime
import re
import shutil
from typing import Literal, final, override
import polars as pl
from bson import ObjectId
from pyarrow import string, timestamp, list_, float64, int32
from pymongoarrow.api import Schema
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel, RefSyncContext
from .utils import get_sample_date_range_filter, update_ref_column
from ..sampling import SamplingContext
from copy import deepcopy


@final
class Calldrivers(ParquetModel):
    collection: str = "calldrivers"
    parquet_filename: str = "calldrivers.parquet"
    filter = None
    projection = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "date": timestamp("ms"),
            "enquiry_line": string(),
            "topic": string(),
            "subtopic": string(),
            "sub_subtopic": string(),
            "tpc_id": int32(),
            "impact": float64(),
            "calls": int32(),
            "selfserve_yes": int32(),
            "selfserve_no": int32(),
            "selfserve_na": int32(),
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("impact").round(4).cast(pl.Float32),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
            pl.col("impact").round(4).cast(pl.Float64),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter.items())

        return filter


@final
class CalldriverModel(MongoCollection):
    collection = "calldrivers"
    sync_type: Literal["simple", "incremental"] = "incremental"
    primary_model = Calldrivers()

    @override
    def sync_refs(self, ref_sync_context: RefSyncContext):
        ref_changes = self.get_ref_changes(ref_sync_context)

        num_changed_refs = ref_changes.height

        if num_changed_refs == 0:
            print(f"No changed refs found for {self.collection}.")
            return

        print(f"Syncing {num_changed_refs} task ref changes for {self.collection}...")

        sync_start = datetime.now()
        file_path = self.primary_model.get_file_path()

        lf = self.primary_model.lf().with_columns(
            pl.col("tasks")
            .list.eval(pl.element().cast(ref_sync_context.task_ids_enum))
            .list.sort(),
            pl.col("projects")
            .list.eval(pl.element().cast(ref_sync_context.project_ids_enum))
            .list.sort(),
        )

        temp_file_path = re.sub(r"\.parquet$", ".temp.parquet", file_path)

        (
            lf.join(ref_changes.lazy(), on="tpc_id", how="left", coalesce=True)
            .with_columns(
                update_ref_column("tasks"),
                update_ref_column("projects"),
            )
            .drop(["tasks_right", "projects_right", "remove_refs"])
            .sort("_id")
            .with_columns(
                pl.col("tasks").list.eval(pl.element().cast(pl.String)),
                pl.col("projects").list.eval(pl.element().cast(pl.String)),
            )
            .sink_parquet(temp_file_path, compression_level=5)
        )

        print(
            f"Wrote updated calldrivers with {num_changed_refs} changed refs to {temp_file_path}."
        )

        shutil.move(temp_file_path, file_path)
        sync_end = datetime.now()
        formatted_sync_time = format((sync_end - sync_start).total_seconds(), ".2f")
        print(f"Synced refs for {self.collection} in {formatted_sync_time} seconds.")

    @override
    def get_ref_changes(self, ref_sync_context: RefSyncContext) -> pl.DataFrame:
        lf = self.primary_model.lf()

        unique_task_refs = lf.select(
            "tpc_id", pl.col("tasks").list.sort(), pl.col("projects").list.sort()
        ).unique()

        # get tpc_ids which have a task ref, but are not in the tasks collection at all
        refs_to_remove_start = datetime.now()
        refs_to_remove = (
            lf.select("tpc_id", "tasks")
            .unique()
            .filter(
                pl.col("tpc_id").is_not_null(),
                pl.col("tasks").is_not_null(),
                pl.col("tasks").list.len() > 0,
            )
            .join(
                ref_sync_context.tasks_by_tpc_id.select(["tpc_id"]).lazy(),
                on="tpc_id",
                how="anti",
            )
            .collect()
        )
        refs_remove_end = datetime.now()
        formatted_remove_time = format(
            (refs_remove_end - refs_to_remove_start).total_seconds(), ".2f"
        )
        print(
            f"Checked for refs to remove in {formatted_remove_time} seconds. Found {refs_to_remove.height} refs to remove."
        )

        # then compare against the tasks collection to find any calldriver topics that have differences in refs
        task_diffs_start = datetime.now()

        task_diffs = (
            unique_task_refs.join(
                ref_sync_context.tasks_by_tpc_id.select(
                    [
                        "tpc_id",
                        pl.col("tasks")
                        .list.eval(pl.element().cast(ref_sync_context.task_ids_enum))
                        .list.sort(),
                        pl.col("projects")
                        .list.eval(pl.element().cast(ref_sync_context.project_ids_enum))
                        .list.sort(),
                    ]
                ).lazy(),
                on="tpc_id",
                how="right",
                nulls_equal=True,
            )
            .filter(
                (pl.col("tasks") != pl.col("tasks_right"))
                | (pl.col("projects") != pl.col("projects_right"))
            )
            .select(
                "tpc_id",
                pl.col("tasks_right").alias("tasks"),
                pl.col("projects_right").alias("projects"),
            )
            .unique()
            .collect()
        )

        task_diffs_end = datetime.now()
        formatted_diffs_time = format(
            (task_diffs_end - task_diffs_start).total_seconds(), ".2f"
        )
        print(
            f"Checked for task ref differences in {formatted_diffs_time} seconds. Found {task_diffs.height} tpc_ids with ref differences."
        )

        combined_changes = pl.concat(
            [
                task_diffs.with_columns(pl.lit(False).alias("remove_refs")),
                refs_to_remove.select(
                    pl.col("tpc_id"),
                    pl.lit(None).alias("tasks"),
                    pl.lit(None).alias("projects"),
                    pl.lit(True).alias("remove_refs"),
                ).unique(),
            ],
            rechunk=True,
        )

        return combined_changes
