import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, bool_
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class GcTss(MongoModel):
    collection: str = "gc_tasks"
    filter: dict | None = None
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "url": string(),
            "date": timestamp("ms"),
            "tasks": list_(ObjectIdType()),
            "language": string(),
            "device": string(),
            "screener": bool_(),
            "department": string(),
            "theme": string(),
            "grouping": string(),
            "gc_task": string(),
            "satisfaction": string(),
            "ease": string(),
            "able_to_complete": string(),
            "what_would_improve": string(),
            "reason_not_complete": string(),
            "sampling_invitation": string(),
            "sampling_gc": string(),
            "sampling_canada": string(),
            "sampling_theme": string(),
            "sampling_institution": string(),
            "sampling_group": string(),
            "sampling_task": string(),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
        ).sort("date", "url")
