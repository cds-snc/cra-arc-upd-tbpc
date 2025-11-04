from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from pyarrow import string, timestamp
from bson import ObjectId
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext


@final
class PagesList(ParquetModel):
    collection: str = "pages_list"
    parquet_filename: str = "pages_list.parquet"
    filter = {}
    projection = None

    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "url": string(),
            "title": string(),
            "lang": string(),  # values: 'en', 'fr', or ''
            "last_255": string(),
            "owners": string(),
            "sections": string(),
            "updatedAt": timestamp("ms"),
            "createdAt": timestamp("ms"),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("updatedAt").cast(pl.Datetime),
            pl.col("createdAt").cast(pl.Datetime),
            pl.col("lang").fill_null("").str.strip_chars(),  # normalize empty/null lang
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        return self.filter


@final
class PagesListModel(MongoCollection):
    collection = "pages_list"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = PagesList()
