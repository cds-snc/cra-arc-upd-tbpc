import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, list_, int32, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class Projects(MongoModel):
    collection: str = "projects"
    filter: dict | None = None
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "title": string(),
            "ux_tests": list_(ObjectIdType()),
            "pages": list_(ObjectIdType()),
            "tasks": list_(ObjectIdType()),
            "description": string(),
            "attachments": list_(
                struct(
                    {
                        "id": string(),
                        "url": string(),
                        "filename": string(),
                        "type": string(),
                        "size": int32(),
                        "storage_url": string(),
                        "_id": ObjectIdType(),
                    }
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("ux_tests").cast(pl.List(pl.Binary)).list.eval(pl.element().bin.encode("hex")),
            pl.col("pages").cast(pl.List(pl.Binary)).list.eval(pl.element().bin.encode("hex")),
            pl.col("tasks").cast(pl.List(pl.Binary)).list.eval(pl.element().bin.encode("hex")),
            pl.col("attachments").list.eval(
                pl.struct([
                    pl.element().struct.field("id").cast(pl.String),
                    pl.element().struct.field("url").cast(pl.String),
                    pl.element().struct.field("filename").cast(pl.String),
                    pl.element().struct.field("type").cast(pl.String),
                    pl.element().struct.field("size").cast(pl.Int32),
                    pl.element().struct.field("storage_url").cast(pl.String),
                    pl.element().struct.field("_id").bin.encode("hex"),
                ])
            )
        )
