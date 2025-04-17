import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel

class Feedback(MongoModel):
    collection: str = "feedback"
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
