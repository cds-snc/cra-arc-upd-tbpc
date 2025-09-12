import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, float64, int32, struct
from pymongoarrow.types import ObjectIdType
from . import AnyFrame, ParquetModel
from .utils import get_sample_ids, get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy

class GSCSearchTerms(ParquetModel):
    collection: str = "pages_metrics"
    parquet_filename: str = "pages_metrics_gsc_searchterms.parquet"
    partition_by = "month"
    filter: dict = {}
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "url": string(),
            "page": ObjectId,
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
            "gsc_searchterms": list_(
                struct(
                    {
                        "clicks": int32(),
                        "ctr": float64(),
                        "impressions": int32(),
                        "position": float64(),
                        "term": string(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )
    secondary_schema: Schema = Schema(
        {
            "gsc_searchterms": list_(
                struct(
                    {
                        "clicks": int32(),
                        "ctr": float64(),
                        "impressions": int32(),
                        "position": float64(),
                        "term": string(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return (
            df.filter(
                pl.col("gsc_searchterms").is_not_null(),
                pl.col("gsc_searchterms").list.len() != 0,
            )
            .rename({"_id": "_doc_id"})
            .explode("gsc_searchterms")
            .with_columns(pl.col("gsc_searchterms").struct.unnest())
            .drop("gsc_searchterms")
            .with_columns(
                pl.col("_doc_id").bin.encode("hex"),
                pl.col("_id").bin.encode("hex"),
                pl.col("page").bin.encode("hex"),
                pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
                pl.col("projects").list.eval(pl.element().bin.encode("hex")),
                pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
                pl.col("ctr").round(4).cast(pl.Float32),
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

    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return (
            df.select(
                [
                    pl.col("_id").str.decode("hex"),
                    pl.struct(
                        [
                            pl.col("term"),
                            pl.col("clicks"),
                            pl.col("ctr"),
                            pl.col("impressions"),
                            pl.col("position"),
                            pl.col("_term_id").str.decode("hex").alias("_id"),
                        ]
                    ).alias("gsc_searchterms"),
                ]
            )
            .group_by("_id")
            .agg(pl.col("gsc_searchterms").implode())
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")
        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update({"tasks": {"$in": task_ids}})
        filter.update(date_range_filter)

        return filter
