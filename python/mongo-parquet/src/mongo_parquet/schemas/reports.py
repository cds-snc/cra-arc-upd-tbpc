import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, int32, timestamp, list_, struct
from pymongoarrow.types import ObjectIdType
from . import MongoCollection, ParquetModel
from ..sampling import SamplingContext


class Reports(ParquetModel):
    collection: str = "reports"
    parquet_filename: str = "reports.parquet"
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
                    }.items()
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
                    }.items()
                )
            ),
            "fr_title": string(),
            "type": string(),
            "updatedAt": timestamp("ms"),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        attachment_field = pl.struct(
            [
                pl.element().struct.field("id").cast(pl.String),
                pl.element().struct.field("url").cast(pl.String),
                pl.element().struct.field("filename").cast(pl.String),
                pl.element().struct.field("size").cast(pl.Int32),
                pl.element().struct.field("storage_url").cast(pl.String),
                pl.element().struct.field("_id").bin.encode("hex"),
            ]
        )

        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("en_attachment").list.eval(attachment_field),
            pl.col("fr_attachment").list.eval(attachment_field),
        ).sort("date")

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
        attachment_field = pl.struct(
            [
                pl.element().struct.field("id"),
                pl.element().struct.field("url"),
                pl.element().struct.field("filename"),
                pl.element().struct.field("size"),
                pl.element().struct.field("storage_url"),
                pl.element().struct.field("_id").str.decode("hex"),
            ]
        )

        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("en_attachment").list.eval(attachment_field),
            pl.col("fr_attachment").list.eval(attachment_field),
        )

    def get_sampling_filter(self, _: SamplingContext) -> dict:
        return self.filter or {}


class ReportsModel(MongoCollection):
    collection = "reports"
    primary_model = Reports()


