import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import bool_, string, timestamp, list_, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class Pages(MongoModel):
    collection: str = "pages"
    filter: dict | None = None
    projection: dict | None = {
        "_id": 1,
        "url": 1,
        "title": 1,
        "airtable_id": 1,
        "lang": 1,
        "altLangHref": 1,
        "redirect": 1,
        "is_404": 1,
        "metadata": {"$objectToArray": "$metadata"},
        "owners": 1,
        "sections": 1,
        "lastChecked": 1,
        "lastModified": 1,
        "tasks": 1,
        "projects": 1,
        "ux_tests": 1,
    }
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "url": string(),
            "title": string(),
            "airtable_id": string(),
            "lang": string(),
            "altLangHref": string(),
            "redirect": string(),
            "is_404": bool_(),
            "metadata": list_(
                struct(
                    {
                        "k": string(),
                        "v": string(),
                    }
                )
            ),
            "owners": string(),
            "sections": string(),
            "lastChecked": timestamp("ms"),
            "lastModified": timestamp("ms"),
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
        )
