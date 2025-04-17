import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import bool_, string, timestamp, list_, float64, int32
from pymongoarrow.types import ObjectIdType
from ..mongo import MongoModel


class UxTests(MongoModel):
    collection: str = "ux_tests"
    filter: dict | None = None
    projection: dict | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "title": string(),
            "airtable_id": string(),
            "project": ObjectId,
            "pages": list_(ObjectIdType()),
            "tasks": list_(ObjectIdType()),
            "subtask": string(),
            "date": timestamp("ms"),
            "success_rate": float64(),
            "test_type": string(),
            "session_type": string(),
            "scenario": string(),
            "vendor": string(),
            "version_tested": string(),
            "github_repo": string(),
            "total_users": int32(),
            "successful_users": int32(),
            "program": string(),
            "branch": string(),
            "project_lead": string(),
            "launch_date": timestamp("ms"),
            "status": string(),
            "cops": bool_(),
            "start_date": timestamp("ms"),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("project").bin.encode("hex"),
            pl.col("pages").list.eval(pl.element().bin.encode("hex")),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
        )

#  @@@@@@@@@@@@@@@@ right now:
#  @@@@@@@@@@@@@@@@ - finish the rest of the drizzle schemas
#  @@@@@@@@@@@@@@@@ - (backup current sql) -> run migrations
#  @@@@@@@@@@@@@@@@ - do some test queries w/ just plain jane imported parquet (i.e. no indexes)
#  @@@@@@@@@@@@@@@@ - (optional?) do some optimizing of parquet files?
#  @@@@@@@@@@@@@@@@   - prune metrics
#  @@@@@@@@@@@@@@@@   - improve sort
#  @@@@@@@@@@@@@@@@ - do some benchmarking