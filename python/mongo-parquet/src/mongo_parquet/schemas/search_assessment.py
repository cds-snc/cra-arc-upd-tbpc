import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, int32, bool_
from . import MongoCollection, ParquetModel
from ..sampling import SamplingContext


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

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(pl.col("_id").bin.encode("hex")).sort("_id")

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(pl.col("_id").str.decode("hex"))

    def get_sampling_filter(self, _: SamplingContext) -> dict:
        return self.filter or {}


class SearchAssessmentModel(MongoCollection):
    collection = "search_assessment"
    primary_model = SearchAssessment()


