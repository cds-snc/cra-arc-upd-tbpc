import polars as pl
from pymongoarrow.api import Schema
from pymongoarrow.types import ObjectIdType
from pyarrow import string, list_
from bson import ObjectId
from . import AnyFrame, MongoCollection, ParquetModel


class AAItemIds(ParquetModel):
    collection: str = "aa_item_ids"
    parquet_filename: str = "aa_item_ids.parquet"
    filter: dict = {}
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "type": string(),
            "page": ObjectId,
            "pages": list_(ObjectIdType()),
            "itemId": string(),
            "value": string(),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
            pl.col("pages").list.eval(pl.element().bin.encode("hex")),
        )

    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
            pl.col("pages").list.eval(pl.element().str.decode("hex")),
        )


class AAItemIdsModel(MongoCollection):
    collection = "aa_item_ids"
    primary_model = AAItemIds()
