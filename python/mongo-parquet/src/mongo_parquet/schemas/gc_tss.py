from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, bool_
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel
from .utils import get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


@final
class GcTss(ParquetModel):
    collection: str = "gc_tasks"
    parquet_filename: str = "gc_tasks.parquet"
    filter = None
    projection = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "url": string(),
            "date": timestamp("ms"),
            "tasks": list_(ObjectIdType()),
            "language": string(),
            "device": string(),
            "screener": bool_(),
            "department": string(),
            "theme": string(),
            "theme_other": string(),
            "grouping": string(),
            "gc_task": string(),
            "gc_task_other": string(),
            "satisfaction": string(),
            "ease": string(),
            "able_to_complete": string(),
            "what_would_improve": string(),
            "what_would_improve_comment": string(),
            "reason_not_complete": string(),
            "reason_not_complete_comment": string(),
            "sampling_invitation": string(),
            "sampling_gc": string(),
            "sampling_canada": string(),
            "sampling_theme": string(),
            "sampling_institution": string(),
            "sampling_group": string(),
            "sampling_task": string(),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
        ).sort("date", "url")

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter.items())

        return filter


@final
class GcTssModel(MongoCollection):
    collection = "gc_tasks"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = GcTss()

    # Turns out GC task refs are never actually populated, so this isn't needed at the moment.
    # @override
    # def sync_refs(self, ref_sync_context: RefSyncContext):
    #     ref_changes = self.get_ref_changes(ref_sync_context)

    #     num_changed_refs = ref_changes.height

    #     if num_changed_refs == 0:
    #         print(f"No changed refs found for {self.collection}.")
    #         return

    #     print(f"Syncing {num_changed_refs} task ref changes for {self.collection}...")

    #     sync_start = datetime.now()
    #     file_path = self.primary_model.get_file_path()

    #     lf = self.primary_model.lf()

    #     temp_file_path = re.sub(r"\.parquet$", ".temp.parquet", file_path)

    #     lf.join(
    #         ref_changes.lazy(), on="gc_task", how="left", coalesce=True
    #     ).sort("_id").sink_parquet(temp_file_path, compression_level=7, engine="streaming")

    #     print(
    #         f"Wrote updated gc_tasks with {num_changed_refs} changed refs to {temp_file_path}."
    #     )

    #     shutil.move(temp_file_path, file_path)
    #     sync_end = datetime.now()
    #     formatted_sync_time = format((sync_end - sync_start).total_seconds(), ".2f")
    #     print(f"Synced refs for {self.collection} in {formatted_sync_time} seconds.")

    # @override
    # def get_ref_changes(self, ref_sync_context: RefSyncContext) -> pl.DataFrame:
    #     lf = self.primary_model.lf()

    #     unique_task_refs = (
    #         lf.select("gc_task", "tasks")
    #         .unique()
    #         .with_columns(pl.col("tasks").list.sort())
    #     )

    #     # get tasks which have a task ref, but are not in the tasks collection at all
    #     refs_to_remove_start = datetime.now()
    #     refs_to_remove = (
    #         lf.select("gc_task", "tasks")
    #         .unique()
    #         .filter(
    #             pl.col("gc_task").is_not_null(),
    #             pl.col("tasks").is_not_null(),
    #             pl.col("tasks").list.len() > 0,
    #         )
    #         .join(
    #             ref_sync_context.tasks_by_gc_task.select(["gc_task"]).lazy(),
    #             on="gc_task",
    #             how="anti",
    #         )
    #         .collect()
    #     )
    #     refs_remove_end = datetime.now()
    #     formatted_remove_time = format(
    #         (refs_remove_end - refs_to_remove_start).total_seconds(), ".2f"
    #     )
    #     print(
    #         f"Checked for refs to remove in {formatted_remove_time} seconds. Found {refs_to_remove.height} refs to remove."
    #     )

    #     # then compare against the tasks collection to find any gc_tasks that have differences in refs
    #     task_diffs_start = datetime.now()

    #     task_diffs = (
    #         unique_task_refs.join(
    #             ref_sync_context.tasks_by_gc_task.select(
    #                 [
    #                     "gc_task",
    #                     pl.col("tasks").list.sort(),
    #                 ]
    #             ).lazy(),
    #             on="gc_task",
    #             how="right",
    #             nulls_equal=True,
    #         )
    #         .filter((pl.col("tasks") != pl.col("tasks_right")))
    #         .select(
    #             "gc_task",
    #             pl.col("tasks_right").alias("tasks"),
    #         )
    #         .unique()
    #         .collect()
    #     )

    #     task_diffs_end = datetime.now()
    #     formatted_diffs_time = format(
    #         (task_diffs_end - task_diffs_start).total_seconds(), ".2f"
    #     )
    #     print(
    #         f"Checked for task ref differences in {formatted_diffs_time} seconds. Found {task_diffs.height} gc_tasks with ref differences."
    #     )

    #     combined_changes = pl.concat(
    #         [
    #             task_diffs,
    #             refs_to_remove.select(
    #                 pl.col("gc_task"),
    #                 pl.lit(None).alias("tasks"),
    #                 pl.lit(None).alias("tasks_right"),
    #             ).unique(),
    #         ],
    #         rechunk=True,
    #     )

    #     return combined_changes
