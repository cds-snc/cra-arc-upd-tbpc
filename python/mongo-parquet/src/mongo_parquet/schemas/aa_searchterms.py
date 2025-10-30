from copy import deepcopy
from typing import Any, final, override
import polars as pl
from pymongoarrow.api import Schema
from pyarrow import float32, string, timestamp, list_, float64, int32, struct
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids, get_sample_date_range_filter


@final
class AASearchTerms(ParquetModel):
    collection: str = "pages_metrics"
    parquet_filename: str = "pages_metrics_aa_searchterms.parquet"
    partition_by = "month"
    filter = {"aa_searchterms": {"$exists": True}}
    projection: dict[str, Any] | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectIdType(),
            "date": timestamp("ms"),
            "url": string(),
            "page": ObjectIdType(),
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
            "aa_searchterms": list_(
                struct(
                    {
                        "term": string(),
                        "clicks": int32(),
                        "position": float64(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )
    secondary_schema: Schema | None = Schema(
        {
            "aa_searchterms": list_(
                struct(
                    {
                        "term": string(),
                        "clicks": int32(),
                        "position": float32(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return (
            df.filter(
                pl.col("aa_searchterms").is_not_null(),
                pl.col("aa_searchterms").list.len() != 0,
            )
            .rename({"_id": "_doc_id"})
            .explode("aa_searchterms")
            .with_columns(pl.col("aa_searchterms").struct.unnest())
            .drop("aa_searchterms")
            .with_columns(
                pl.col("_doc_id").bin.encode("hex"),
                pl.col("_id").bin.encode("hex"),
                pl.col("page").bin.encode("hex"),
                pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
                pl.col("projects").list.eval(pl.element().bin.encode("hex")),
                pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
                pl.col("position").round(4).cast(pl.Float32),
            )
            .rename(
                {
                    "_doc_id": "_id",
                    "_id": "_term_id",
                }
            )
            .sort("clicks", descending=True)
            .sort("date", "url")
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return (
            df.select(
                [
                    pl.col("_id").str.decode("hex"),
                    pl.struct(
                        [
                            pl.col("term"),
                            pl.col("clicks"),
                            pl.col("position"),
                            pl.col("_term_id").str.decode("hex").alias("_id"),
                        ]
                    ).alias("aa_searchterms"),
                ]
            )
            .group_by("_id")
            .agg(
                pl.col("aa_searchterms").implode(),
            )
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")
        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update({"tasks": {"$in": task_ids}})
        filter.update(date_range_filter.items())

        return filter
