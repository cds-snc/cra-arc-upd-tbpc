import polars as pl
from pymongoarrow.api import Schema
from pyarrow import string, list_, struct, timestamp, bool_
from bson import ObjectId
from . import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext


class CustomReportsRegistry(ParquetModel):
    collection: str = "custom_reports_registry"
    parquet_filename: str = "custom_reports_registry.parquet"
    filter: dict = {}
    projection: dict | None = None

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

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
        )

    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
        )

    def get_sampling_filter(self, _: SamplingContext) -> dict:
        return self.filter


class CustomReportsRegistryModel(MongoCollection):
    collection = "custom_reports_registry"
    primary_model = CustomReportsRegistry()


