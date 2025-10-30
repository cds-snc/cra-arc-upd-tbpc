from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from pyarrow import string, list_, struct, timestamp, bool_
from bson import ObjectId
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext


@final
class CustomReportsRegistry(ParquetModel):
    collection: str = "custom_reports_registry"
    parquet_filename: str = "custom_reports_registry.parquet"
    filter = {}
    projection = None

    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "config": struct(
                {
                    "dateRange": struct(
                        {
                            "start": timestamp("ms"),
                            "end": timestamp("ms"),
                        }.items()
                    ),
                    "granularity": string(),
                    "urls": list_(string()),
                    "grouped": bool_(),
                    "metrics": list_(string()),
                    "breakdownDimension": string(),
                }.items()
            ),
            "configHash": string(),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
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
class CustomReportsRegistryModel(MongoCollection):
    collection = "custom_reports_registry"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = CustomReportsRegistry()
