from typing import Literal, final, override
import polars as pl
from bson import ObjectId
from pyarrow import string, timestamp, list_, float64, int32
from pymongoarrow.api import Schema
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel
from .utils import get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


@final
class Calldrivers(ParquetModel):
    collection: str = "calldrivers"
    parquet_filename: str = "calldrivers.parquet"
    filter = None
    projection = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "date": timestamp("ms"),
            "enquiry_line": string(),
            "topic": string(),
            "subtopic": string(),
            "sub_subtopic": string(),
            "tpc_id": int32(),
            "impact": float64(),
            "calls": int32(),
            "selfserve_yes": int32(),
            "selfserve_no": int32(),
            "selfserve_na": int32(),
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("impact").round(4).cast(pl.Float32),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
            pl.col("impact"),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter.items())

        return filter


@final
class CalldriverModel(MongoCollection):
    collection = "calldrivers"
    sync_type: Literal["simple", "incremental"] = "incremental"
    primary_model = Calldrivers()
