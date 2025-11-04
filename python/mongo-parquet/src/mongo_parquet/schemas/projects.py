from copy import deepcopy
from typing import Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, list_, int32, struct
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids


@final
class Projects(ParquetModel):
    collection: str = "projects"
    parquet_filename: str = "projects.parquet"
    filter = None
    projection = None
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "title": string(),
            "ux_tests": list_(ObjectIdType()),
            "pages": list_(ObjectIdType()),
            "tasks": list_(ObjectIdType()),
            "description": string(),
            "attachments": list_(
                struct(
                    {
                        "id": string(),
                        "url": string(),
                        "filename": string(),
                        "type": string(),
                        "size": int32(),
                        "storage_url": string(),
                        "_id": ObjectIdType(),
                    }.items()
                )
            ),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("ux_tests")
            .cast(pl.List(pl.Binary))
            .list.eval(pl.element().bin.encode("hex")),
            pl.col("pages")
            .cast(pl.List(pl.Binary))
            .list.eval(pl.element().bin.encode("hex")),
            pl.col("tasks")
            .cast(pl.List(pl.Binary))
            .list.eval(pl.element().bin.encode("hex")),
            pl.col("attachments").list.eval(
                pl.struct(
                    [
                        pl.element().struct.field("id").cast(pl.String),
                        pl.element().struct.field("url").cast(pl.String),
                        pl.element().struct.field("filename").cast(pl.String),
                        pl.element().struct.field("type").cast(pl.String),
                        pl.element().struct.field("size").cast(pl.Int32),
                        pl.element().struct.field("storage_url").cast(pl.String),
                        pl.element().struct.field("_id").bin.encode("hex"),
                    ]
                )
            ),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("ux_tests").list.eval(pl.element().str.decode("hex")),
            pl.col("pages").list.eval(pl.element().str.decode("hex")),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("attachments").list.eval(
                pl.struct(
                    [
                        pl.element().struct.field("id"),
                        pl.element().struct.field("url"),
                        pl.element().struct.field("filename"),
                        pl.element().struct.field("type"),
                        pl.element().struct.field("size"),
                        pl.element().struct.field("storage_url"),
                        pl.element().struct.field("_id").str.decode("hex"),
                    ]
                )
            ),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        project_ids = get_sample_ids(sampling_context, "project")

        filter.update({"_id": {"$in": project_ids}})

        return filter


@final
class ProjectsModel(MongoCollection):
    collection = "projects"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = Projects()
