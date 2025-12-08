import abc
import os
from datetime import datetime
import polars as pl
import pyarrow
from pymongo.database import Database
from pymongo.collection import Collection
from pymongoarrow.api import Schema
from typing import (
    Any,
    Callable,
    Literal,
    TypeVar,
    overload,
)
from ..sampling import SamplingContext
from ..utils import convert_objectids, get_partition_values


type PartitionBy = Literal["month"] | Literal["year"]

AnyFrame = TypeVar("AnyFrame", pl.DataFrame, pl.LazyFrame)


class ParquetModel(abc.ABC):
    collection: str
    schema: Schema
    parquet_filename: str
    dir_path: str = ""
    ref_fields: list[str] | None = None
    secondary_schema: Schema | None = None
    """Partial schema to be combined with the primary"""
    filter: dict[str, Any] | None = None
    projection: dict[str, Any] | None = None
    use_aggregation: bool | None = None
    start: datetime | None = None
    end: datetime | None = None
    pipeline: list[dict[str, Any]] | None = None
    partition_by: PartitionBy | None = None

    def __init__(self, dir_path: str | None = None):
        if dir_path:
            self.dir_path = dir_path

    @overload
    def transform(self, df: pl.DataFrame) -> pl.DataFrame: ...

    @overload
    def transform(self, df: pl.LazyFrame) -> pl.LazyFrame: ...

    @abc.abstractmethod
    def transform(self, df: AnyFrame) -> AnyFrame:
        pass

    @overload
    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame: ...

    @overload
    def reverse_transform(self, df: pl.LazyFrame) -> pl.LazyFrame: ...

    @abc.abstractmethod
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        pass

    def get_sampling_filter(
        self,
        sampling_context: SamplingContext,  # pyright: ignore[reportUnusedParameter]
    ) -> dict[str, Any] | None:
        """
        Returns a filter to be applied to the MongoDB query based on the sampling context.
        If no filter is needed, return None.
        """
        return self.filter

    def lf(self, dir_path: str | None = None) -> pl.LazyFrame:
        """
        Returns a LazyFrame for the Parquet file(s), with hive partitioning if applicable.
        """
        read_path = os.path.join(dir_path or self.dir_path, self.parquet_filename)
        is_dir = os.path.isdir(read_path)

        return pl.scan_parquet(
            read_path, hive_partitioning=self.partition_by is not None and is_dir
        )

    def get_partition_values(self) -> list[dict[str, int]] | None:
        """
        Returns a dictionary of partition values if the model is partitioned.
        """
        if self.partition_by is None:
            return None

        return get_partition_values(self.lf(), self.partition_by)

    def iter_partitions(self, callback: Callable[[pl.LazyFrame], None]):
        partition_values = self.get_partition_values()
        if partition_values is None:
            return callback(self.lf())

        for partition_value in partition_values:
            year = partition_value.get("year")
            month = partition_value.get("month")

            if year is None and month is None:
                raise ValueError("Partition values must include 'year' or 'month'.")

            partition_keys = [("year", year), ("month", month)]

            partition_filters = [
                (pl.col(k) == v) for k, v in partition_keys if v is not None
            ]

            callback(self.lf().filter(*partition_filters))

    def latest_date(self) -> datetime | None:
        """
        Returns the latest date found in the parquet file(s).
        """
        return self.lf().select(pl.col("date").max()).collect()["date"].item()


class MongoCollection(abc.ABC):
    collection: str
    client: Collection[Any]
    parquet_dir_path: str = ""
    sync_type: Literal["simple", "incremental"]
    primary_model: ParquetModel
    secondary_models: list[ParquetModel] = []
    objectid_fields: list[str] = [
        "_id",
        "task",
        "tasks",
        "page",
        "pages",
        "project",
        "projects",
        "ux_tests",
        "attachments",
        "en_attachment",
        "fr_attachment",
        "aa_searchterms",
        "aa_searchterms_en",
        "aa_searchterms_fr",
        "activity_map",
        "gsc_searchterms",
    ]
    default_values: dict[str, Any] = {
        "pages": [],
        "tasks": [],
        "projects": [],
        "ux_tests": [],
        "attachments": [],
        "calldriversEnquiry": [],
        "callsByTopic": [],
    }

    def __init__(self, db: Database[Any], parquet_dir_path: str | None = None):
        self.client = db[self.collection]
        if parquet_dir_path:
            self.parquet_dir_path = parquet_dir_path
        self.primary_model.dir_path = self.parquet_dir_path
        for model in self.secondary_models:
            model.dir_path = self.parquet_dir_path

    @overload
    def assemble(
        self, primary_df: pl.DataFrame, secondary_dfs: list[pl.DataFrame] | None
    ) -> pl.DataFrame: ...

    @overload
    def assemble(
        self, primary_df: pl.LazyFrame, secondary_dfs: list[pl.LazyFrame] | None
    ) -> pl.LazyFrame: ...

    def assemble(
        self,
        primary_df: AnyFrame,
        secondary_dfs: list[AnyFrame] | None = None,
    ) -> AnyFrame:
        if secondary_dfs is None or len(secondary_dfs) == 0:
            return primary_df

        df = primary_df

        for secondary_df in secondary_dfs:
            df = df.join(secondary_df, on="_id", how="left", maintain_order="left")

        return df

    def combined_schema(self) -> Schema:
        combined = self.primary_model.schema.to_arrow()

        for model in self.secondary_models:
            combined = pyarrow.unify_schemas(
                [
                    combined,
                    model.secondary_schema.to_arrow()
                    if model.secondary_schema
                    else model.schema.to_arrow(),
                ]
            )

        return Schema.from_arrow(combined)

    def prepare_for_insert(
        self, df: pl.DataFrame, sort_id: bool = True
    ) -> list[dict[str, Any]]:
        """
        Prepares the data for insertion into MongoDB.
        This method should be overridden by models that require specific transformations.
        """
        records: list[dict[str, Any]] = []

        col_names = self.combined_schema().to_arrow().names

        rows = df.sort("_id").to_dicts() if sort_id else df.to_dicts()

        for row in rows:
            record: dict[str, Any] = {}
            for k, v in row.items():
                if v is None and k not in self.default_values:
                    continue
                elif v is None and k in self.default_values:
                    record[k] = self.default_values[k]

                if k in self.objectid_fields:
                    record[k] = convert_objectids(v)
                else:
                    record[k] = v

            for col in col_names:
                if (
                    col not in record or record[col] is None
                ) and col in self.default_values:
                    record[col] = self.default_values[col]

            records.append(record)

        del rows

        return records

    def sync_refs(self):
        """
        Sync collection references (e.g. tasks, pages, projects, ux_tests).
        This method should be called after the referenced collections have been synced.

        :param mp: The MongoParquet instance to use for syncing.
        """
        raise NotImplementedError("sync_refs method not implemented.")
