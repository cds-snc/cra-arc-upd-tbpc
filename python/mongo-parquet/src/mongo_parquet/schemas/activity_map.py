import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, timestamp, list_, int32, struct
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class ActivityMap(MongoModel):
    collection: str = "pages_metrics"
    filter: dict = {"activity_map": {"$exists": True}}
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
            "activity_map": list_(
                struct(
                    {
                        "link": string(),
                        "clicks": int32(),
                    }
                )
            ),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return (
            df.filter(
                pl.col("activity_map").is_not_null(),
                pl.col("activity_map").list.len() != 0,
            )
            .with_columns(
                pl.col("activity_map")
                .list.eval(
                    pl.element().sort_by(
                        pl.element().struct.field("clicks"), descending=True
                    )
                )
                .list.slice(0, 300)
            )
            .explode("activity_map")
            .with_columns(pl.col("activity_map").struct.unnest())
            .drop("activity_map")
            .with_columns(
                pl.col("_id").bin.encode("hex"),
                pl.col("page").bin.encode("hex"),
                pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
                pl.col("projects").list.eval(pl.element().bin.encode("hex")),
                pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
            )
            .sort("date", "url", "clicks", descending=[False, False, True])
        )
