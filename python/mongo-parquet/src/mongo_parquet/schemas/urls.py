# The `Urls` class defines a model for interacting with a MongoDB collection named "urls" and includes
# schema definitions and transformation methods for working with data in that collection.
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import bool_, string, timestamp, list_, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class Urls(MongoModel):
    collection: str = "urls"
    filter: dict | None = None
    projection: dict | None = {
        "_id": 1,
        "url": 1,
        "title": 1,
        "page": 1,
        "hashes": 1,
        "links": 1,
        "langHrefs": 1,
        "is_404": 1,
        "metadata": {"$objectToArray": "$metadata"},
        "langHrefs": {"$objectToArray": "$langHrefs"},
        "all_titles": 1,
        "latest_snapshot": 1,
        "last_checked": 1,
        "last_modified": 1,
    }
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "page": ObjectId,
            "url": string(),
            "title": string(),
            "is_404": bool_(),
            "metadata": list_(
                struct(
                    {
                        "k": string(),
                        "v": string(),
                    }
                )
            ),
            "langHrefs": list_(
                struct(
                    {
                        "k": string(),
                        "v": string(),
                    }
                )
            ),
            "hashes": list_(
                struct(
                    {
                        "date": timestamp("ms"),
                        "hash": string(),
                    }
                )
            ),
            "links": list_(
                struct(
                    {
                        "href": string(),
                        "text": string(),
                    }
                )
            ),
            "all_titles": list_(string()),
            "latest_snapshot": string(),
            "last_checked": timestamp("ms"),
            "last_modified": timestamp("ms"),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
        )
