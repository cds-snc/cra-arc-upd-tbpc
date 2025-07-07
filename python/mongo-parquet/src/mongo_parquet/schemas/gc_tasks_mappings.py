import polars as pl
from pymongoarrow.api import Schema
from pymongoarrow.types import ObjectIdType
from pyarrow import string, list_, timestamp
from bson import ObjectId
from . import MongoCollection, ParquetModel
from ..sampling import SamplingContext


class GcTasksMappings(ParquetModel):
    collection: str = "gc_tasks_mappings"
    parquet_filename: str = "gc_tasks_mappings.parquet"
    filter: dict = {}
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "title": string(),
            "title_fr": string(),
            "tasks": list_(ObjectIdType()),  # Can be ObjectId or Task ref
            "date_mapped": timestamp("ms"),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("date_mapped").cast(pl.Datetime),
        )

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("date_mapped"),
        )

    def get_sampling_filter(self, _: SamplingContext) -> dict:
        return self.filter


class GcTasksMappingsModel(MongoCollection):
    collection = "gc_tasks_mappings"
    primary_model = GcTasksMappings()


