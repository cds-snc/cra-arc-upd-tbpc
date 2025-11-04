from typing import Any, Literal, final, override
import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import bool_, string, timestamp, list_, struct
from .lib import AnyFrame, MongoCollection, ParquetModel
from ..sampling import SamplingContext
from ..utils import array_to_object, convert_objectids


@final
class Urls(ParquetModel):
    collection: str = "urls"
    parquet_filename: str = "urls.parquet"
    filter = None
    use_aggregation = True
    projection = {
        "_id": 1,
        "url": 1,
        "title": 1,
        "page": 1,
        "hashes": 1,
        "links": 1,
        "langHrefs": 1,
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
        "all_titles": 1,
        "latest_snapshot": 1,
        "last_checked": 1,
        "last_modified": 1,
    }
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "page": ObjectId,
            "url": string(),
            "title": string(),
            "is_404": bool_(),
            "metadata": list_(
                struct(
                    {
                        "k": string(),
                        "v": string(),
                    }.items()
                )
            ),
            "langHrefs": struct(
                {
                    "en": string(),
                    "fr": string(),
                }.items()
            ),
            "hashes": list_(
                struct(
                    {
                        "date": timestamp("ms"),
                        "hash": string(),
                    }.items()
                )
            ),
            "links": list_(
                struct(
                    {
                        "href": string(),
                        "text": string(),
                    }.items()
                )
            ),
            "all_titles": list_(string()),
            "latest_snapshot": string(),
            "last_checked": timestamp("ms"),
            "last_modified": timestamp("ms"),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
        )

    @override
    def get_sampling_filter(self, sampling_context: SamplingContext):
        return self.filter or {}


@final
class UrlsModel(MongoCollection):
    collection = "urls"
    sync_type: Literal["simple", "incremental"] = "simple"
    primary_model = Urls()

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
