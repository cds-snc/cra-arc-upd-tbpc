import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, int32, timestamp, list_, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class Reports(MongoModel):
    collection: str = "reports"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "createdAt": timestamp("ms"),
            "date": timestamp("ms"),
            "en_attachment": list_(
                struct(
                    {
                        "id": string(),
                        "url": string(),
                        "filename": string(),
                        "size": int32(),
                        "storage_url": string(),
                        "_id": ObjectIdType(),
                    }
                )
            ),
            "en_title": string(),
            "fr_attachment": list_(
                struct(
                    {
                        "id": string(),
                        "url": string(),
                        "filename": string(),
                        "size": int32(),
                        "storage_url": string(),
                        "_id": ObjectIdType(),
                    }
                )
            ),
            "fr_title": string(),
            "type": string(),
            "updatedAt": timestamp("ms"),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("en_attachment").list.eval(
                pl.struct([
                    pl.element().struct.field("id").cast(pl.String),
                    pl.element().struct.field("url").cast(pl.String),
                    pl.element().struct.field("filename").cast(pl.String),
                    pl.element().struct.field("size").cast(pl.Int32),
                    pl.element().struct.field("storage_url").cast(pl.String),
                    pl.element().struct.field("_id").bin.encode("hex"),
                ])
            ),
            pl.col("fr_attachment").list.eval(
                pl.struct([
                    pl.element().struct.field("id").cast(pl.String),
                    pl.element().struct.field("url").cast(pl.String),
                    pl.element().struct.field("filename").cast(pl.String),
                    pl.element().struct.field("size").cast(pl.Int32),
                    pl.element().struct.field("storage_url").cast(pl.String),
                    pl.element().struct.field("_id").bin.encode("hex"),
                ])
            )
        ).sort("date")