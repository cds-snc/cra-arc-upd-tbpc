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
    TypedDict,
    final,
    overload,
)
from ..sampling import SamplingContext
from ..utils import convert_objectids, get_partition_values


type PartitionBy = Literal["month"] | Literal["year"]

AnyFrame = TypeVar("AnyFrame", pl.DataFrame, pl.LazyFrame)


class DateRange(TypedDict):
    start: datetime
    end: datetime


class RefChanges(TypedDict):
    new_ids: pl.DataFrame
    removed_ids: pl.DataFrame
    changed_refs: pl.DataFrame


class PartitionValues(TypedDict):
    month: int | None
    year: int


class ParquetModel(abc.ABC):
    collection: str
    schema: Schema
    parquet_filename: str
    dir_path: str = ""
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

    def get_file_path(self) -> str:
        """
        Returns the file path for the Parquet file. If the model is partitioned, this will return the path to a directory.
        """

        return os.path.join(self.dir_path, self.parquet_filename)

    def get_partition_file_path(
        self,
        partition_values: PartitionValues,
        partition_filename: str = "0.parquet",  # default file name from polars partitioned write
    ) -> str:
        """
        Returns the file path for a given set of partition values.
        :param partition_values: A dictionary of partition values (e.g. {"year": 2023, "month": 5}).
        :param partition_filename: The name of the Parquet file within the partition directory (default is "0.parquet" for polars).
        :return: The full file path to the Parquet file for the given partition values.
        """
        if self.partition_by is None:
            raise ValueError("Model is not partitioned.")

        year_path = f"year={partition_values['year']}"

        month_path = (
            f"month={partition_values['month']}" if self.partition_by == "month" else ""
        )

        return os.path.join(
            self.dir_path,
            self.parquet_filename,
            year_path,
            month_path,
            partition_filename,
        )

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

    def latest_date(self, where_col_not_null: str | None = None) -> datetime | None:
        """
        Returns the latest date found in the parquet file(s).
        """
        lf = self.lf()
        if where_col_not_null is not None:
            lf = lf.filter(pl.col(where_col_not_null).is_not_null())
        return lf.select(pl.col("date").max()).collect()["date"].item()


ParquetModels = TypedDict(
    "ParquetModels",
    {
        "annotations": ParquetModel,
        "aa_item_ids": ParquetModel,
        "aa_searchterms": ParquetModel,
        "activity_map": ParquetModel,
        "calldrivers": ParquetModel,
        "custom_reports_registry": ParquetModel,
        "feedback": ParquetModel,
        "gsc_searchterms": ParquetModel,
        "gc_tss": ParquetModel,
        "gc_tasks_mappings": ParquetModel,
        "overall_metrics": ParquetModel,
        "overall_aa_searchterms_en": ParquetModel,
        "overall_aa_searchterms_fr": ParquetModel,
        "overall_gsc_searchterms": ParquetModel,
        "pages_list": ParquetModel,
        "pages": ParquetModel,
        "page_metrics": ParquetModel,
        "projects": ParquetModel,
        "tasks": ParquetModel,
        "urls": ParquetModel,
        "ux_tests": ParquetModel,
        "readability": ParquetModel,
        "reports": ParquetModel,
        "search_assessment": ParquetModel,
    },
)


def get_parquet_models(dir_path: str | None = None) -> ParquetModels:
    from .aa_item_ids import AAItemIds
    from .aa_searchterms import AASearchTerms
    from .activity_map import ActivityMap
    from .calldrivers import Calldrivers
    from .custom_reports_registry import CustomReportsRegistry  # noqa: E402
    from .gsc_searchterms import GSCSearchTerms  # noqa: E402
    from .pages import Pages  # noqa: E402
    from .pages_list import PagesList  # noqa: E402
    from .page_metrics import PageMetrics  # noqa: E402
    from .projects import Projects  # noqa: E402
    from .tasks import Tasks  # noqa: E402
    from .ux_tests import UxTests  # noqa: E402
    from .feedback import Feedback  # noqa: E402
    from .gc_tss import GcTss  # noqa: E402
    from .gc_tasks_mappings import GcTasksMappings
    from .overall_metrics import OverallMetrics
    from .overall_aa_searchterms_en import OverallAASearchTermsEn
    from .overall_aa_searchterms_fr import OverallAASearchTermsFr
    from .overall_gsc_searchterms import OverallGSCSearchTerms
    from .urls import Urls
    from .readability import Readability
    from .reports import Reports
    from .search_assessment import SearchAssessment
    from .annotations import Annotations

    return {
        "annotations": Annotations(dir_path),
        "aa_item_ids": AAItemIds(dir_path),
        "aa_searchterms": AASearchTerms(dir_path),
        "activity_map": ActivityMap(dir_path),
        "calldrivers": Calldrivers(dir_path),
        "custom_reports_registry": CustomReportsRegistry(dir_path),
        "feedback": Feedback(dir_path),
        "gsc_searchterms": GSCSearchTerms(dir_path),
        "gc_tss": GcTss(dir_path),
        "gc_tasks_mappings": GcTasksMappings(dir_path),
        "overall_metrics": OverallMetrics(dir_path),
        "overall_aa_searchterms_en": OverallAASearchTermsEn(dir_path),
        "overall_aa_searchterms_fr": OverallAASearchTermsFr(dir_path),
        "overall_gsc_searchterms": OverallGSCSearchTerms(dir_path),
        "pages_list": PagesList(dir_path),
        "pages": Pages(dir_path),
        "page_metrics": PageMetrics(dir_path),
        "projects": Projects(dir_path),
        "tasks": Tasks(dir_path),
        "urls": Urls(dir_path),
        "ux_tests": UxTests(dir_path),
        "readability": Readability(dir_path),
        "reports": Reports(dir_path),
        "search_assessment": SearchAssessment(dir_path),
    }


type RefModelName = Literal["pages", "tasks", "projects", "ux_tests"]

ref_model_names: list[RefModelName] = ["pages", "tasks", "projects", "ux_tests"]


@final
class RefSyncContext:
    """
    Context for syncing references, containing the necessary information about
    which references have changed and what the new values are, in order to
    update any affected Parquet files accordingly.
    """

    def __init__(self, data_dir: str) -> None:
        self.parquet_models = get_parquet_models(data_dir)
        self.page_urls_enum = self._get_page_urls_enum()
        self.pages = self._get_pages()
        self.tasks_by_tpc_id = self._get_tasks_by_tpc_id()
        self.tasks_by_gc_task = self._get_tasks_by_gc_task()

    def _get_pages(self) -> pl.LazyFrame:
        return (
            self.parquet_models["pages"]
            .lf()
            .select(
                [
                    pl.col("_id"),
                    pl.col("url").cast(self.page_urls_enum),
                    pl.col("tasks"),
                    pl.col("projects"),
                ]
            )
            .sort("url")
        )

    def _get_page_urls_enum(self) -> pl.Enum:
        unique_metrics_urls = (
            self.parquet_models["page_metrics"].lf().select(pl.col("url").unique())
        )
        unique_page_urls = (
            self.parquet_models["pages"].lf().select(pl.col("url").unique())
        )
        unique_activity_map_urls = (
            self.parquet_models["activity_map"].lf().select(pl.col("url").unique())
        )
        unique_gsc_searchterms_urls = (
            self.parquet_models["gsc_searchterms"].lf().select(pl.col("url").unique())
        )
        unique_feedback_urls = (
            self.parquet_models["feedback"].lf().select(pl.col("url").unique())
        )
        unique_readability_urls = (
            self.parquet_models["readability"].lf().select(pl.col("url").unique())
        )
        unique_combined = (
            pl.concat(
                [
                    unique_metrics_urls,
                    unique_page_urls,
                    unique_activity_map_urls,
                    unique_gsc_searchterms_urls,
                    unique_feedback_urls,
                    unique_readability_urls,
                ]
            )
            .select(pl.col("url").unique())
            .collect()
        )

        return pl.Enum(unique_combined["url"])

    def _get_tasks_by_tpc_id(self) -> pl.DataFrame:
        return (
            self.parquet_models["tasks"]
            .lf()
            .select(pl.col("_id"), pl.col("tpc_ids"), pl.col("projects"))
            .filter(pl.col("tpc_ids").is_not_null(), pl.col("tpc_ids").list.len() > 0)
            .explode("tpc_ids")
            .group_by("tpc_ids")
            .agg(
                pl.col("_id").sort().implode().alias("tasks"),
                pl.col("projects")
                .explode(empty_as_null=False, keep_nulls=False)
                .unique()
                .sort(),
            )
            .rename({"tpc_ids": "tpc_id"})
            .collect()
        )

    def _get_tasks_by_gc_task(self) -> pl.DataFrame:
        return (
            self.parquet_models["tasks"]
            .lf()
            .select(
                pl.col("_id"),
                pl.col("gc_tasks")
                .list.eval(pl.element().struct.field("title"))
                .list.unique()
                .alias("gc_task"),
            )
            .filter(pl.col("gc_task").is_not_null(), pl.col("gc_task").list.len() > 0)
            .explode("gc_task")
            .group_by("gc_task")
            .agg(pl.col("_id").sort().implode().alias("tasks"))
            .collect()
        )


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

    def sync_refs(
        self,
        ref_sync_context: RefSyncContext,  # pyright: ignore[reportUnusedParameter]
    ):
        """
        Sync collection references (e.g. tasks, pages, projects, ux_tests).
        This method should be called after the referenced collections have been synced.

        :param ref_sync_context: The context containing the reference synchronization data dependencies.
        """
        pass

    def get_ref_changes(
        self,
        ref_sync_context: RefSyncContext,  # pyright: ignore[reportUnusedParameter]
    ) -> pl.DataFrame:  # pyright: ignore[reportReturnType]
        """
        Get the differences in references within the data for this collection, compared to
        the "source of truth" reference models, in order to determine if any updates are needed to keep the Parquet files in sync.

        :param parquet_models: The current Parquet models to compare against.
        :return: A DataFrame containing the new IDs, removed IDs, and changed references, or an empty DataFrame if no changes.
        """
        pass
