import pyarrow as pa
import polars as pl
from pymongoarrow.api import Schema
from pymongoarrow.types import struct
from bson import ObjectId
from pyarrow import string, timestamp, list_, float64, int32
from pymongoarrow.types import ObjectIdType
from . import ParquetModel
from .utils import get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


class OverallGSCSearchTerms(ParquetModel):
    collection: str = "overall_metrics"
    parquet_filename: str = "overall_metrics_gsc_searchterms.parquet"
    filter: dict = {"gsc_searchterms": {"$exists": True}}
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
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
            .sort("date")
        )

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
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
            .agg(
                pl.col("gsc_searchterms").implode(),
            )
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter)

        return filter
