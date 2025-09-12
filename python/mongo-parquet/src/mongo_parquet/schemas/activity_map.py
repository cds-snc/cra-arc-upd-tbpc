import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, int32, struct
from pymongoarrow.types import ObjectIdType
from . import AnyFrame, ParquetModel
from .utils import get_sample_ids, get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


class ActivityMap(ParquetModel):
    collection: str = "pages_metrics"
    parquet_filename: str = "pages_metrics_activity_map.parquet"
    partition_by = "month"
    filter: dict = {"activity_map": {"$exists": True}}
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "url": string(),
            "page": ObjectId,
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
            "activity_map": list_(
                struct(
                    {
                        "link": string(),
                        "clicks": int32(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )
    secondary_schema: Schema = Schema(
        {
            "activity_map": list_(
                struct(
                    {
                        "link": string(),
                        "clicks": int32(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return (
            df.filter(
                pl.col("activity_map").is_not_null(),
                pl.col("activity_map").list.len() != 0,
            )
            .rename({"_id": "_doc_id"})
            .with_columns(
                pl.col("activity_map")
                .list.eval(
                    pl.element().sort_by(
                        pl.element().struct.field("clicks"), descending=True
                    )
                )
                .list.slice(0, 300)
            )
            .explode("activity_map")
            .with_columns(pl.col("activity_map").struct.unnest())
            .drop("activity_map")
            .with_columns(
                pl.col("_doc_id").bin.encode("hex"),
                pl.col("_id").bin.encode("hex"),
                pl.col("page").bin.encode("hex"),
                pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
                pl.col("projects").list.eval(pl.element().bin.encode("hex")),
                pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
            )
            .rename(
                {
                    "_doc_id": "_id",
                    "_id": "_link_id",
                }
            )
            .sort("date", "url", "clicks", descending=[False, False, True])
        )

    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return (
            df.select(
                [
                    pl.col("_id").str.decode("hex"),
                    pl.struct(
                        [
                            pl.col("link"),
                            pl.col("clicks"),
                            pl.col("_link_id").str.decode("hex").alias("_id"),
                        ]
                    ).alias("activity_map"),
                ]
            )
            .group_by("_id")
            .agg(pl.col("activity_map").implode())
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")
        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update({"tasks": {"$in": task_ids}})
        filter.update(date_range_filter)

        return filter
