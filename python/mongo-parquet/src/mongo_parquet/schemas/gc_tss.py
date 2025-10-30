from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, bool_
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel
from .utils import get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


@final
class GcTss(ParquetModel):
    collection: str = "gc_tasks"
    parquet_filename: str = "gc_tasks.parquet"
    filter = None
    projection = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "url": string(),
            "date": timestamp("ms"),
            "tasks": list_(ObjectIdType()),
            "language": string(),
            "device": string(),
            "screener": bool_(),
            "department": string(),
            "theme": string(),
            "theme_other": string(),
            "grouping": string(),
            "gc_task": string(),
            "gc_task_other": string(),
            "satisfaction": string(),
            "ease": string(),
            "able_to_complete": string(),
            "what_would_improve": string(),
            "what_would_improve_comment": string(),
            "reason_not_complete": string(),
            "reason_not_complete_comment": string(),
            "sampling_invitation": string(),
            "sampling_gc": string(),
            "sampling_canada": string(),
            "sampling_theme": string(),
            "sampling_institution": string(),
            "sampling_group": string(),
            "sampling_task": string(),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
        ).sort("date", "url")

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter.items())

        return filter


@final
class GcTssModel(MongoCollection):
    collection = "gc_tasks"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = GcTss()
