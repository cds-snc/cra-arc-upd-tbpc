import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, float64, int32, timestamp, list_, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class Readability(MongoModel):
    collection: str = "readability"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "page": ObjectId,
            "date": timestamp("ms"),
            "url": string(),
            "avg_words_per_header": float64(),
            "avg_words_per_paragraph": float64(),
            "final_fk_score": float64(),
            "fk_points": float64(),
            "hash": string(),
            "header_points": float64(),
            "lang": string(),
            "original_score": float64(),
            "paragraph_points": float64(),
            "total_headings": int32(),
            "total_paragraph": int32(),
            "total_score": float64(),
            "total_sentences": int32(),
            "total_syllables": int32(),
            "total_words": int32(),
            "word_counts": list_(
                struct(
                    {
                        "word": string(),
                        "count": int32(),
                    }
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
        ).sort("date")
