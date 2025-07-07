import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_
from pymongoarrow.types import ObjectIdType
from . import MongoCollection, ParquetModel
from .utils import get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


class Feedback(ParquetModel):
    collection: str = "feedback"
    parquet_filename: str = "feedback.parquet"
    filter: dict | None = None
    projection: dict | None = None
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

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
        )

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter)

        return filter


class FeedbackModel(MongoCollection):
    collection = "feedback"
    primary_model = Feedback()


