from copy import deepcopy
from typing import List, override
import polars as pl
from pymongoarrow.api import Schema
from pyarrow import bool_, string, struct, timestamp, list_
from pymongoarrow.types import ObjectIdType
from . import MongoCollection, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids
from ..utils import array_to_object, convert_objectids


class Pages(ParquetModel):
    collection: str = "pages"
    parquet_filename: str = "pages.parquet"
    filter: dict | None = None
    projection: dict | None = {
        "_id": 1,
        "url": 1,
        "title": 1,
        "airtable_id": 1,
        "lang": 1,
        "altLangHref": 1,
        "redirect": 1,
        "is_404": 1,
        "metadata": {
            "$map": {
                "input": {"$objectToArray": "$metadata"},
                "as": "item",
                "in": {
                    "k": "$$item.k",
                    "v": {"$toString": "$$item.v"},
                },
            }
        },
        "owners": 1,
        "sections": 1,
        "lastChecked": 1,
        "lastModified": 1,
        "tasks": 1,
        "projects": 1,
        "ux_tests": 1,
    }
    schema: Schema = Schema(
        {
            "_id": ObjectIdType(),
            "url": string(),
            "title": string(),
            "airtable_id": string(),
            "lang": string(),
            "altLangHref": string(),
            "redirect": string(),
            "is_404": bool_(),
            "metadata": list_(
                struct(
                    {
                        "k": string(),
                        "v": string(),
                    }.items()
                )
            ),
            "owners": string(),
            "sections": string(),
            "lastChecked": timestamp("ms"),
            "lastModified": timestamp("ms"),
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
        )

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
            pl.col("ux_tests").list.eval(pl.element().str.decode("hex")),
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")

        filter.update({"tasks": {"$in": task_ids}})

        return filter


class PagesModel(MongoCollection):
    collection = "pages"
    primary_model = Pages()

    @override
    def prepare_for_insert(self, df: pl.DataFrame) -> List[dict]:
        records = []

        col_names = self.combined_schema().to_arrow().names

        for row in df.sort("_id").to_dicts():
            record = {}
            for k, v in row.items():
                if k == "metadata":
                    v = array_to_object(v)
                    continue
                if v is None and k not in self.default_values:
                    continue
                elif v is None and k in self.default_values:
                    record[k] = self.default_values[k]

                if k in self.objectid_fields:
                    record[k] = convert_objectids(v)
                else:
                    record[k] = v

            for col in col_names:
                if col not in record and col in self.default_values:
                    record[col] = self.default_values[col]

            records.append(record)

        return records
