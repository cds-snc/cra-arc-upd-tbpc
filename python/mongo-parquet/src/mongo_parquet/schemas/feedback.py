from datetime import datetime
import re
import shutil
from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel, RefSyncContext
from .utils import get_sample_date_range_filter, update_ref_column
from ..sampling import SamplingContext
from copy import deepcopy


@final
class Feedback(ParquetModel):
    collection: str = "feedback"
    parquet_filename: str = "feedback.parquet"
    filter = None
    projection = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "url": string(),
            "date": timestamp("ms"),
            "lang": string(),
            "comment": string(),
            "words": list_(string()),
            "tags": list_(string()),
            "status": string(),
            "whats_wrong": string(),
            "main_section": string(),
            "theme": string(),
            "page": ObjectId,
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter.items())

        return filter


@final
class FeedbackModel(MongoCollection):
    collection = "feedback"
    sync_type: Literal["simple", "incremental"] = "incremental"
    primary_model = Feedback()

    @override
    def sync_refs(self, ref_sync_context: RefSyncContext) -> None:
        ref_changes = self.get_ref_changes(ref_sync_context)

        num_changed_refs = ref_changes.height

        if num_changed_refs == 0:
            print(f"No changed refs found for {self.collection}.")
            return

        print(f"Syncing {num_changed_refs} page ref changes for {self.collection}...")

        sync_start = datetime.now()
        file_path = self.primary_model.get_file_path()

        lf = self.primary_model.lf().with_columns(
            pl.col("url").cast(ref_sync_context.page_urls_enum),
            pl.col("page").cast(ref_sync_context.page_ids_enum),
            pl.col("tasks").list.eval(
                pl.element().cast(ref_sync_context.task_ids_enum)
            ),
            pl.col("projects").list.eval(
                pl.element().cast(ref_sync_context.project_ids_enum)
            ),
        )

        temp_file_path = re.sub(r"\.parquet$", ".temp.parquet", file_path)

        (
            lf.join(ref_changes.lazy(), on="url", how="left", coalesce=True)
            .with_columns(
                update_ref_column("page"),
                update_ref_column("tasks"),
                update_ref_column("projects"),
            )
            .drop(["page_right", "tasks_right", "projects_right", "remove_refs"])
            .sort("_id")
            .with_columns(
                pl.col("url").cast(pl.String),
                pl.col("page").cast(pl.String),
                pl.col("tasks").list.eval(pl.element().cast(pl.String)),
                pl.col("projects").list.eval(pl.element().cast(pl.String)),
            )
            .sink_parquet(temp_file_path, compression_level=7)
        )

        print(
            f"Wrote updated page metrics with {num_changed_refs} changed refs to {temp_file_path}."
        )

        shutil.move(temp_file_path, file_path)
        sync_end = datetime.now()
        formatted_sync_time = format((sync_end - sync_start).total_seconds(), ".2f")
        print(f"Synced refs for {self.collection} in {formatted_sync_time} seconds.")

    @override
    def get_ref_changes(self, ref_sync_context: RefSyncContext) -> pl.DataFrame:
        lf = self.primary_model.lf()

        unique_page_refs = lf.select(
            pl.col("url").cast(ref_sync_context.page_urls_enum),
            "page",
            "tasks",
            "projects",
        ).unique()

        # get urls which have a page ref, but are not in the pages collection at all
        refs_to_remove_start = datetime.now()
        refs_to_remove = (
            lf.select(pl.col("url").cast(ref_sync_context.page_urls_enum), "page")
            .unique()
            .filter(pl.col("page").is_not_null())
            .join(ref_sync_context.pages.select(["url"]), on="url", how="anti")
            .collect()
        )

        refs_remove_end = datetime.now()
        formatted_remove_time = format(
            (refs_remove_end - refs_to_remove_start).total_seconds(), ".2f"
        )
        print(
            f"Checked for refs to remove in {formatted_remove_time} seconds. Found {refs_to_remove.height} refs to remove."
        )

        # then compare against the pages collection to find any urls that have differences in refs
        page_diffs_start = datetime.now()

        page_diffs = (
            unique_page_refs.join(
                ref_sync_context.pages.select(
                    [pl.col("_id").alias("page"), "url", "tasks", "projects"]
                ),
                on="url",
                how="right",
                nulls_equal=True,
            )
            .filter(
                (pl.col("page") != pl.col("page_right"))
                | (pl.col("tasks") != pl.col("tasks_right"))
                | (pl.col("projects") != pl.col("projects_right"))
            )
            .select(
                "url",
                pl.col("page_right").alias("page"),
                pl.col("tasks_right").alias("tasks"),
                pl.col("projects_right").alias("projects"),
            )
            .unique()
            .collect()
        )

        page_diffs_end = datetime.now()
        formatted_page_diff_time = format(
            (page_diffs_end - page_diffs_start).total_seconds(), ".2f"
        )
        print(
            f"Checked for page ref differences in {formatted_page_diff_time} seconds. Found {page_diffs.height} pages with ref differences."
        )

        combined_changes = pl.concat(
            [
                page_diffs.with_columns(pl.lit(False).alias("remove_refs")),
                refs_to_remove.select(
                    pl.col("url"),
                    pl.lit(None).alias("page"),
                    pl.lit(None).alias("tasks"),
                    pl.lit(None).alias("projects"),
                    pl.lit(True).alias("remove_refs"),
                ).unique(),
            ],
            rechunk=True,
        )

        return combined_changes
