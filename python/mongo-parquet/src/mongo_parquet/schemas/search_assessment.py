import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, int32, bool_
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class SearchAssessment(MongoModel):
    collection: str = "search_assessment"
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
        return (
            df.with_columns(pl.col("_id").bin.encode("hex"))
              .sort("date", descending=True)
              .head(200)
        )
