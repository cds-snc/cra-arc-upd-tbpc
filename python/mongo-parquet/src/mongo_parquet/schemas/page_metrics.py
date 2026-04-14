import os
import re
from typing import Any, Literal, final, override
from datetime import datetime
import shutil
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import int64, string, timestamp, list_, float64, int32
from pymongoarrow.types import ObjectIdType
from .lib import (
    AnyFrame,
    MongoCollection,
    ParquetModel,
    RefSyncContext,
    PartitionValues,
)
from .aa_searchterms import AASearchTerms
from .activity_map import ActivityMap
from .gsc_searchterms import GSCSearchTerms
from .utils import get_sample_ids, get_sample_date_range_filter, update_ref_column
from ..sampling import SamplingContext
from copy import deepcopy


@final
class PageMetrics(ParquetModel):
    collection: str = "pages_metrics"
    parquet_filename: str = "pages_metrics.parquet"
    partition_by = "month"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "url": string(),
            "page": ObjectId,
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
            "average_time_spent": float64(),
            "bouncerate": float64(),
            "dyf_no": int32(),
            "dyf_submit": int32(),
            "dyf_yes": int32(),
            "gsc_total_clicks": int64(),
            "gsc_total_ctr": float64(),
            "gsc_total_impressions": int64(),
            "gsc_total_position": float64(),
            "nav_menu_initiated": int32(),
            "views": int32(),
            "visitors": int32(),
            "visits": int32(),
            "visits_device_desktop": int32(),
            "visits_device_mobile": int32(),
            "visits_device_other": int32(),
            "visits_device_tablet": int32(),
            "visits_geo_ab": int32(),
            "visits_geo_bc": int32(),
            "visits_geo_mb": int32(),
            "visits_geo_nb": int32(),
            "visits_geo_nl": int32(),
            "visits_geo_ns": int32(),
            "visits_geo_nt": int32(),
            "visits_geo_nu": int32(),
            "visits_geo_on": int32(),
            "visits_geo_outside_canada": int32(),
            "visits_geo_pe": int32(),
            "visits_geo_qc": int32(),
            "visits_geo_sk": int32(),
            "visits_geo_us": int32(),
            "visits_geo_yt": int32(),
            "visits_referrer_other": int32(),
            "visits_referrer_searchengine": int32(),
            "visits_referrer_social": int32(),
            "visits_referrer_typed_bookmarked": int32(),
            "visits_referrer_convo_ai": int32(),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
            pl.col("average_time_spent").round(4).cast(pl.Float32),
            pl.col("bouncerate").round(4).cast(pl.Float32),
            pl.col("gsc_total_ctr").round(4).cast(pl.Float32),
            pl.col("gsc_total_position").round(4).cast(pl.Float32),
        ).sort("date", "url")

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
            pl.col("ux_tests").list.eval(pl.element().str.decode("hex")),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict[str, Any]:
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")
        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update({"tasks": {"$in": task_ids}})
        filter.update(date_range_filter.items())

        return filter


@final
class PagesMetricsModel(MongoCollection):
    collection = "pages_metrics"
    sync_type: Literal["simple", "incremental"] = "incremental"
    primary_model = PageMetrics()
    secondary_models = [
        AASearchTerms(),
        ActivityMap(),
        GSCSearchTerms(),
    ]

    @override
    def sync_refs(self, ref_sync_context: RefSyncContext) -> None:
        ref_changes = self.get_ref_changes(ref_sync_context)

        if ref_changes.height == 0:
            print("No page changes to sync.")
            return

        print(f"Syncing {ref_changes.height} page ref changes for {self.collection}...")

        # first do primary model and accumulate/concat all _ids, to be used for updating secondary models

        # do both "in parallel" while iterating over partitions
        # (will need to use primary model partition values because secondary models
        #   don't have a url field which is needed to find the changed refs)

        # The callback function for syncing each model, using the partition values of the primary model
        def sync_partition(partition: PartitionValues | None = None) -> None:
            sync_partition_start = datetime.now()
            primary_file_path = (
                self.primary_model.get_partition_file_path(partition)
                if partition is not None
                else self.primary_model.get_file_path()
            )

            primary_lf = pl.scan_parquet(primary_file_path).with_columns(
                pl.col("url").cast(ref_sync_context.page_urls_enum),
                pl.col("page").cast(ref_sync_context.page_ids_enum),
                pl.col("tasks").list.eval(
                    pl.element().cast(ref_sync_context.task_ids_enum)
                ),
                pl.col("projects").list.eval(
                    pl.element().cast(ref_sync_context.project_ids_enum)
                ),
            )

            # get ids with changed refs
            changed_ids = (
                primary_lf.select(["_id", "url"])
                .join(
                    ref_changes.select(
                        "url",
                        "page",
                        "tasks",
                        "projects",
                        "remove_refs",
                        pl.lit(True).alias("has_change"),
                    ).lazy(),
                    on="url",
                    how="left",
                )
                .filter(pl.col("has_change").or_(pl.col("remove_refs")))
                .drop("url", "has_change")
                .unique()
            )

            num_changed_ids = changed_ids.select(pl.len()).collect().item()

            if num_changed_ids == 0:
                print(
                    f"No changed refs found in partition {partition} for {self.collection}."
                )
                return

            # now we have the changed_ids for this partition, we can update all the parquet files
            primary_temp_file_path = re.sub(
                r"\.parquet$", ".temp.parquet", primary_file_path
            )

            lazy_sinks: list[pl.LazyFrame] = []
            file_moves: list[tuple[str, str]] = []

            lazy_sinks.append(
                primary_lf.join(changed_ids, on="_id", how="left", coalesce=True)
                .with_columns(
                    update_ref_column("page"),
                    update_ref_column("tasks"),
                    update_ref_column("projects"),
                )
                .drop(["page_right", "tasks_right", "projects_right", "remove_refs"])
                # re-cast enums to string for output, to avoid potential issues with different enum types between files
                .with_columns(
                    pl.col("url").cast(pl.String),
                    pl.col("page").cast(pl.String),
                    pl.col("tasks").list.eval(pl.element().cast(pl.String)),
                    pl.col("projects").list.eval(pl.element().cast(pl.String)),
                )
                .sink_parquet(primary_temp_file_path, compression_level=7, lazy=True)
            )

            file_moves.append((primary_temp_file_path, primary_file_path))

            for secondary_model in self.secondary_models:
                searchterm_enum: tuple[str, pl.Enum] | None = None

                if (
                    secondary_model.parquet_filename
                    == "pages_metrics_aa_searchterms.parquet"
                ):
                    unique_searchterms = (
                        secondary_model.lf()
                        .select(pl.col("term").unique())
                        .filter(pl.col("term").is_not_null())
                        .collect()["term"]
                    )
                    searchterm_enum = ("term", pl.Enum(unique_searchterms))
                elif (
                    secondary_model.parquet_filename
                    == "pages_metrics_gsc_searchterms.parquet"
                ):
                    unique_searchterms = (
                        secondary_model.lf()
                        .select(pl.col("term").unique())
                        .filter(pl.col("term").is_not_null())
                        .collect()["term"]
                    )
                    searchterm_enum = ("term", pl.Enum(unique_searchterms))
                elif (
                    secondary_model.parquet_filename
                    == "pages_metrics_activity_map.parquet"
                ):
                    unique_searchterms = (
                        secondary_model.lf()
                        .select(pl.col("link").unique())
                        .filter(pl.col("link").is_not_null())
                        .collect()["link"]
                    )
                    searchterm_enum = ("link", pl.Enum(unique_searchterms))

                secondary_file_path = (
                    secondary_model.get_partition_file_path(partition)
                    if partition is not None
                    else secondary_model.get_file_path()
                )

                # make sure the secondary file exists before trying to update it, since some secondary models may not have all
                # the same partitions as the primary model
                if not os.path.exists(secondary_file_path):
                    continue

                secondary_temp_file_path = re.sub(
                    r"\.parquet$", r".temp.parquet", secondary_file_path
                )

                def update_refs_expr(
                    searchterm_enum: tuple[str, pl.Enum] | None = None,
                ) -> pl.LazyFrame:
                    if searchterm_enum is not None:
                        return (
                            pl.scan_parquet(secondary_file_path)
                            .with_columns(
                                pl.col("page").cast(ref_sync_context.page_ids_enum),
                                pl.col("tasks").list.eval(
                                    pl.element().cast(ref_sync_context.task_ids_enum)
                                ),
                                pl.col("projects").list.eval(
                                    pl.element().cast(ref_sync_context.project_ids_enum)
                                ),
                                pl.col(searchterm_enum[0]).cast(searchterm_enum[1]),
                            )
                            .join(changed_ids, on="_id", how="left", coalesce=True)
                            .with_columns(
                                update_ref_column("page"),
                                update_ref_column("tasks"),
                                update_ref_column("projects"),
                            )
                            .drop(
                                [
                                    "page_right",
                                    "tasks_right",
                                    "projects_right",
                                    "remove_refs",
                                ]
                            )
                            # re-cast enums to string for output, to avoid potential issues with different enum types between files
                            .with_columns(
                                pl.col(searchterm_enum[0]).cast(pl.String),
                                pl.col("page").cast(pl.String),
                                pl.col("tasks").list.eval(pl.element().cast(pl.String)),
                                pl.col("projects").list.eval(
                                    pl.element().cast(pl.String)
                                ),
                            )
                            .sink_parquet(
                                secondary_temp_file_path,
                                compression_level=5,
                                lazy=True,
                            )
                        )

                    return (
                        pl.scan_parquet(secondary_file_path)
                        .join(changed_ids, on="_id", how="left", coalesce=True)
                        .with_columns(
                            update_ref_column("page"),
                            update_ref_column("tasks"),
                            update_ref_column("projects"),
                        )
                        .drop(
                            [
                                "page_right",
                                "tasks_right",
                                "projects_right",
                                "remove_refs",
                            ]
                        )
                        # re-cast enums to string for output, to avoid potential issues with different enum types between files
                        .with_columns(
                            pl.col("page").cast(pl.String),
                            pl.col("tasks").list.eval(pl.element().cast(pl.String)),
                            pl.col("projects").list.eval(pl.element().cast(pl.String)),
                        )
                        .sink_parquet(
                            secondary_temp_file_path,
                            compression_level=5,
                            lazy=True,
                        )
                    )

                lazy_sinks.append(update_refs_expr(searchterm_enum))

                file_moves.append((secondary_temp_file_path, secondary_file_path))

            pl.collect_all(lazy_sinks)

            for src, dst in file_moves:
                print(f"Overwriting {dst}...")
                shutil.move(src, dst)

            print(
                f"Finished syncing page ref changes for partition {partition} in {datetime.now() - sync_partition_start} seconds."
            )

        all_partitions_sync_start = datetime.now()

        if self.primary_model.partition_by is None:
            sync_partition()
        else:
            for partition in self.primary_model.get_partition_values() or []:
                partition = PartitionValues(**partition)
                sync_partition(partition)

        print(
            f"Finished syncing page ref changes for all partitions in {datetime.now() - all_partitions_sync_start} seconds."
        )

    @override
    def get_ref_changes(self, ref_sync_context: RefSyncContext):
        lf = self.primary_model.lf()

        unique_page_refs = lf.select(
            pl.col("url").cast(ref_sync_context.page_urls_enum),
            pl.col("page").cast(ref_sync_context.page_ids_enum),
            pl.col("tasks").list.eval(
                pl.element().cast(ref_sync_context.task_ids_enum)
            ),
            pl.col("projects").list.eval(
                pl.element().cast(ref_sync_context.project_ids_enum)
            ),
        ).unique()

        # get urls which have a page ref, but are not in the pages collection at all
        refs_to_remove_start = datetime.now()
        refs_to_remove = (
            lf.select(
                pl.col("url").cast(ref_sync_context.page_urls_enum),
                pl.col("page").cast(ref_sync_context.page_ids_enum),
            )
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
