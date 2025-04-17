import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, float64, int32, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class OverallGSCSearchTerms(MongoModel):
    collection: str = "overall_metrics"
    filter: dict = {"gsc_searchterms": {"$exists": True}}
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "gsc_searchterms": list_(
                struct(
                    {
                        "clicks": int32(),
                        "ctr": float64(),
                        "impressions": int32(),
                        "position": float64(),
                        "term": string(),
                    }
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return (
            df.filter(
                pl.col("gsc_searchterms").is_not_null(),
                pl.col("gsc_searchterms").list.len() != 0,
            )
            .explode("gsc_searchterms")
            .with_columns(pl.col("gsc_searchterms").struct.unnest())
            .drop("gsc_searchterms")
            .with_columns(
                pl.col("_id").bin.encode("hex"),
                pl.col("ctr").round(4).cast(pl.Float32),
                pl.col("position").round(4).cast(pl.Float32),
            )
            .sort("clicks", descending=True)
            .sort("date")
        )

# todo: derive lang, remove empty lists