import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, list_, int32, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class Tasks(MongoModel):
    collection: str = "tasks"
    filter: dict | None = None
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "title": string(),
            "title_fr": string(),
            "group": string(),
            "subgroup": string(),
            "topic": string(),
            "subtopic": string(),
            "sub_subtopic": list_(string()),
            "user_type": list_(string()),
            "ux_tests": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "pages": list_(ObjectIdType()),
            "gc_tasks": list_(struct({
                "_id": ObjectIdType(),
                "airtable_id": string(),
                "title": string(),
                "title_fr": string(),
                "tasks": list_(ObjectIdType()),
                "date_mapped": string(),
            }.items())),
            "tpc_ids": list_(int32()),
            "program": string(),
            "service": string(),
            "user_journey": list_(string()),
            "status": string(),
            "channel": list_(string()),
            "core": list_(string()),
            "portfolio": string(),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("pages").list.eval(pl.element().bin.encode("hex")),
        )
