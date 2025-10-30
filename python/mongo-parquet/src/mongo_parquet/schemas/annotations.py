from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext


@final
class Annotations(ParquetModel):
    collection: str = "annotations"
    parquet_filename: str = "annotations.parquet"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "data_affected": list_(string()),
            "date_entered": timestamp("ms"),
            "description": string(),
            "description_fr": string(),
            "event_date": timestamp("ms"),
            "event_type": string(),
            "notes": string(),
            "notes_fr": string(),
            "predictive_insight": string(),
            "predictive_insight_fr": string(),
            "title": string(),
            "title_fr": string(),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(pl.col("_id").bin.encode("hex")).sort("event_date")

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(pl.col("_id").str.decode("hex"))

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        return self.filter or {}


@final
class AnnotationsModel(MongoCollection):
    collection = "annotations"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = Annotations()
