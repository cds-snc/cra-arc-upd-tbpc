from typing import Any, Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from pymongoarrow.types import ObjectIdType
from pyarrow import string, list_
from bson import ObjectId
from .lib import AnyFrame, MongoCollection, ParquetModel


class AAItemIds(ParquetModel):
    collection: str = "aa_item_ids"
    parquet_filename: str = "aa_item_ids.parquet"
    filter: dict[str, Any] | None = {}
    projection: dict[str, Any] | None = None
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

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
            pl.col("pages").list.eval(pl.element().bin.encode("hex")),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
            pl.col("pages").list.eval(pl.element().str.decode("hex")),
        )


@final
class AAItemIdsModel(MongoCollection):
    collection = "aa_item_ids"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = AAItemIds()
