import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class Annotations(MongoModel):
    collection: str = "annotations"
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

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex")
        ).sort("event_date")
