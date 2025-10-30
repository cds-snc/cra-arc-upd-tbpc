from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from pymongoarrow.types import ObjectIdType
from pyarrow import string, list_, timestamp
from bson import ObjectId
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext


@final
class GcTasksMappings(ParquetModel):
    collection: str = "gc_tasks_mappings"
    parquet_filename: str = "gc_tasks_mappings.parquet"
    filter = {}
    projection = None
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

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("date_mapped").cast(pl.Datetime),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("date_mapped"),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        return self.filter


@final
class GcTasksMappingsModel(MongoCollection):
    collection = "gc_tasks_mappings"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = GcTasksMappings()
