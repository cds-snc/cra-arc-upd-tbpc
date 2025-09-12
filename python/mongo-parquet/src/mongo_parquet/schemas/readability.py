from copy import deepcopy
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, float64, int32, timestamp, list_, struct
from . import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids, get_sample_date_range_filter


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

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
        ).sort("_id")

    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        page_ids = get_sample_ids(sampling_context, "page")
        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update({"page": {"$in": page_ids}})
        filter.update(date_range_filter)

        return filter


class ReadabilityModel(MongoCollection):
    collection = "readability"
    primary_model = Readability()


