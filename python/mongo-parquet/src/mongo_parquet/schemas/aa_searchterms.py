import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, float64, int32, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class AASearchTerms(MongoModel):
    collection: str = "pages_metrics"
    filter: dict = {"aa_searchterms": {"$exists": True}}
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "url": string(),
            "page": ObjectId,
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
            "aa_searchterms": list_(
                struct(
                    {
                        "term": string(),
                        "clicks": int32(),
                        "position": float64(),
                    }
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return (
            df.filter(
                pl.col("aa_searchterms").is_not_null(),
                pl.col("aa_searchterms").list.len() != 0,
            )
            .explode("aa_searchterms")
            .with_columns(pl.col("aa_searchterms").struct.unnest())
            .drop("aa_searchterms")
            .with_columns(
                pl.col("_id").bin.encode("hex"),
                pl.col("page").bin.encode("hex"),
                pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
                pl.col("projects").list.eval(pl.element().bin.encode("hex")),
                pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
                pl.col("position").round(4).cast(pl.Float32),
            )
            .sort("clicks", descending=True)
            .sort("date", "url")
        )

# todo: derive lang, remove empty lists