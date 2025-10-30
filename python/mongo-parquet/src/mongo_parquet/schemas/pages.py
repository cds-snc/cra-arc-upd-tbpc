from copy import deepcopy
from typing import Any, Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from pyarrow import bool_, string, struct, timestamp, list_
from pymongoarrow.types import ObjectIdType
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext
from .utils import get_sample_ids
from ..utils import array_to_object, convert_objectids


@final
class Pages(ParquetModel):
    collection: str = "pages"
    parquet_filename: str = "pages.parquet"
    filter = None
    use_aggregation = True
    projection = {
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

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
            pl.col("ux_tests").list.eval(pl.element().str.decode("hex")),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")

        filter.update({"tasks": {"$in": task_ids}})

        return filter


@final
class PagesModel(MongoCollection):
    collection = "pages"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = Pages()

    @override
    def prepare_for_insert(self, df: pl.DataFrame, sort_id: bool = True):
        records: list[dict[str, Any]] = []

        col_names = self.combined_schema().to_arrow().names

        for row in df.sort("_id").to_dicts():
            record: dict[str, Any] = {}
            for k, v in row.items():
                if k == "metadata":
                    v = array_to_object(v)
                    record[k] = v
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
