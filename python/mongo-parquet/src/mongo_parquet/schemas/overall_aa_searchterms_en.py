import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, float64, int32, struct
from pymongoarrow.types import ObjectIdType
from . import AnyFrame, ParquetModel
from .utils import get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


class OverallAASearchTermsEn(ParquetModel):
    collection: str = "overall_metrics"
    parquet_filename: str = "overall_metrics_aa_searchterms_en.parquet"
    filter: dict = {"aa_searchterms_en": {"$exists": True}}
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "aa_searchterms_en": list_(
                struct(
                    {
                        "term": string(),
                        "clicks": int32(),
                        "position": float64(),
                        "num_searches": int32(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )
    secondary_schema: Schema = Schema(
        {
            "aa_searchterms_en": list_(
                struct(
                    {
                        "term": string(),
                        "clicks": int32(),
                        "position": float64(),
                        "num_searches": int32(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return (
            df.filter(
                pl.col("aa_searchterms_en").is_not_null(),
                pl.col("aa_searchterms_en").list.len() != 0,
            )
            .rename({"_id": "_doc_id"})
            .explode("aa_searchterms_en")
            .with_columns(pl.col("aa_searchterms_en").struct.unnest())
            .drop("aa_searchterms_en")
            .with_columns(
                pl.col("_doc_id").bin.encode("hex"),
                pl.col("_id").bin.encode("hex"),
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

    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return (
            df.select(
                [
                    pl.col("_id").str.decode("hex"),
                    pl.struct(
                        [
                            pl.col("term"),
                            pl.col("clicks"),
                            pl.col("num_searches"),
                            pl.col("position"),
                            pl.col("_term_id").str.decode("hex").alias("_id"),
                        ]
                    ).alias("aa_searchterms_en"),
                ]
            )
            .group_by("_id")
            .agg(
                pl.col("aa_searchterms_en").implode(),
            )
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter)

        return filter
