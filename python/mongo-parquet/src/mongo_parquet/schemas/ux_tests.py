from copy import deepcopy
from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import bool_, string, timestamp, list_, float64, int32
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids


@final
class UxTests(ParquetModel):
    collection: str = "ux_tests"
    parquet_filename: str = "ux_tests.parquet"
    filter = None
    projection = None
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

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("project").bin.encode("hex"),
            pl.col("pages").list.eval(pl.element().bin.encode("hex")),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("project").str.decode("hex"),
            pl.col("pages").list.eval(pl.element().str.decode("hex")),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")

        filter.update({"tasks": {"$in": task_ids}})

        return filter


@final
class UxTestsModel(MongoCollection):
    collection = "ux_tests"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = UxTests()
