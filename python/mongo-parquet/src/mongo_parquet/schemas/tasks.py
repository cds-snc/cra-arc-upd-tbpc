from copy import deepcopy
from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, list_, int32, struct, timestamp
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids


@final
class Tasks(ParquetModel):
    collection: str = "tasks"
    parquet_filename: str = "tasks.parquet"
    filter = None
    projection = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "airtable_id": string(),
            "title": string(),
            "title_fr": string(),
            "group": string(),
            "subgroup": string(),
            "topic": string(),
            "subtopic": string(),
            "sub_subtopic": list_(string()),
            "user_type": list_(string()),
            "ux_tests": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "pages": list_(ObjectIdType()),
            "gc_tasks": list_(
                struct(
                    {
                        # "_id": ObjectIdType(), # should be an ObjectId, but isn't?
                        "_id": string(),
                        "airtable_id": string(),
                        "title": string(),
                        "title_fr": string(),
                        "date_mapped": timestamp("ms"),
                    }.items()
                )
            ),
            "tpc_ids": list_(int32()),
            "program": string(),
            "service": string(),
            "user_journey": list_(string()),
            "status": string(),
            "channel": list_(string()),
            "core": list_(string()),
            "portfolio": string(),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("pages").list.eval(pl.element().bin.encode("hex")),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("ux_tests").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
            pl.col("pages").list.eval(pl.element().str.decode("hex")),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")

        filter.update({"_id": {"$in": task_ids}})

        return filter


@final
class TasksModel(MongoCollection):
    collection = "tasks"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = Tasks()
