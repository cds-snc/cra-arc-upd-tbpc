from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, int32, bool_
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext


@final
class SearchAssessment(ParquetModel):
    collection: str = "search_assessment"
    parquet_filename: str = "search_assessment.parquet"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "lang": string(),
            "query": string(),
            "expected_result": string(),
            "expected_position": int32(),
            "pass": bool_(),
            "total_searches": int32(),
            "total_clicks": int32(),
            "target_clicks": int32(),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(pl.col("_id").bin.encode("hex")).sort("_id")

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(pl.col("_id").str.decode("hex"))

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        return self.filter or {}


@final
class SearchAssessmentModel(MongoCollection):
    collection = "search_assessment"
    sync_type: Literal["simple", "incremental"] = "incremental"
    primary_model = SearchAssessment()
