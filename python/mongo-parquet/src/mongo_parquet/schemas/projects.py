from copy import deepcopy
from typing import List, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import string, list_, int32, struct
from pymongoarrow.types import ObjectIdType
from . import MongoCollection, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids
from ..utils import array_to_object, convert_objectids


class Projects(ParquetModel):
    collection: str = "projects"
    parquet_filename: str = "projects.parquet"
    filter: dict | None = None
    projection: dict | None = None
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

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
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

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
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

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        project_ids = get_sample_ids(sampling_context, "project")

        filter.update({"_id": {"$in": project_ids}})

        return filter


class ProjectsModel(MongoCollection):
    collection = "projects"
    primary_model = Projects()
