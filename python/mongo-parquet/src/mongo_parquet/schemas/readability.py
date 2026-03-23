from copy import deepcopy
from datetime import datetime
import re
import shutil
from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, float64, int32, timestamp, list_, struct
from .lib import AnyFrame, MongoCollection, ParquetModel, RefSyncContext
from ..sampling import SamplingContext
from .utils import get_sample_ids, get_sample_date_range_filter, update_ref_column


@final
class Readability(ParquetModel):
    collection: str = "readability"
    parquet_filename: str = "readability.parquet"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "page": ObjectId,
            "date": timestamp("ms"),
            "url": string(),
            "avg_words_per_header": float64(),
            "avg_words_per_paragraph": float64(),
            "final_fk_score": float64(),
            "fk_points": float64(),
            "hash": string(),
            "header_points": float64(),
            "lang": string(),
            "original_score": float64(),
            "paragraph_points": float64(),
            "total_headings": int32(),
            "total_paragraph": int32(),
            "total_score": float64(),
            "total_sentences": int32(),
            "total_syllables": int32(),
            "total_words": int32(),
            "word_counts": list_(
                struct(
                    {
                        "word": string(),
                        "count": int32(),
                    }.items()
                )
            ),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
        ).sort("_id")

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        page_ids = get_sample_ids(sampling_context, "page")
        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update({"page": {"$in": page_ids}})
        filter.update(date_range_filter.items())

        return filter


@final
class ReadabilityModel(MongoCollection):
    collection = "readability"
    sync_type: Literal["simple", "incremental"] = "incremental"
    primary_model = Readability()

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
            pl.col("url").cast(ref_sync_context.page_urls_enum)
        )

        temp_file_path = re.sub(r"\.parquet$", ".temp.parquet", file_path)

        (
            lf.join(ref_changes.lazy(), on="url", how="left", coalesce=True)
            .with_columns(
                # re-cast url to string for output, to avoid potential issues with different enum types between files
                pl.col("url").cast(pl.String),
                update_ref_column("page"),
            )
            .drop(["page_right", "remove_refs"])
            .sort("_id")
            .sink_parquet(temp_file_path, compression_level=7, engine="streaming")
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
                ref_sync_context.pages.select([pl.col("_id").alias("page"), "url"]),
                on="url",
                how="right",
                nulls_equal=True,
            )
            .filter((pl.col("page") != pl.col("page_right")))
            .select(
                "url",
                pl.col("page_right").alias("page"),
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
                    pl.lit(True).alias("remove_refs"),
                ).unique(),
            ],
            rechunk=True,
        )

        return combined_changes
