import abc
from datetime import datetime
import polars as pl
import pyarrow
from pymongoarrow.api import Schema
from typing import List, Literal, Optional, Union
from ..sampling import SamplingContext
from ..utils import convert_objectids


type PartitionBy = Union[Literal["month"], Literal["year"]]


class ParquetModel(abc.ABC):
    collection: str
    schema: Schema
    parquet_filename: str
    secondary_schema: Optional[Schema] = None
    """Partial schema to be combined with the primary"""
    filter: Optional[dict] = None
    projection: Optional[dict] = None
    use_aggregation: Optional[bool] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    pipeline: Optional[list] = None
    partition_by: Optional[PartitionBy] = None

    @abc.abstractmethod
    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        pass

    @abc.abstractmethod
    def reverse_transform(
        self, df: pl.DataFrame, with_objectid_instances: bool = True
    ) -> pl.DataFrame:
        pass

    def get_sampling_filter(self, sampling_context: SamplingContext) -> Optional[dict]:
        """
        Returns a filter to be applied to the MongoDB query based on the sampling context.
        If no filter is needed, return None.
        """
        return self.filter


class MongoCollection:
    collection: str
    primary_model: ParquetModel
    secondary_models: List[ParquetModel] = []
    objectid_fields: List[str] = [
        "_id",
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
    default_values: dict = {
        "pages": [],
        "tasks": [],
        "projects": [],
        "ux_tests": [],
        "attachments": [],
    }

    def assemble(
        self,
        primary_df: pl.DataFrame,
        secondary_dfs: Optional[List[pl.DataFrame]] = None,
    ) -> pl.DataFrame:
        if secondary_dfs is None or len(secondary_dfs) == 0:
            return primary_df

        df = primary_df

        for secondary_df in secondary_dfs:
            df = df.join(secondary_df, on="_id", how="left")

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

    def prepare_for_insert(self, df: pl.DataFrame) -> List[dict]:
        """
        Prepares the data for insertion into MongoDB.
        This method should be overridden by models that require specific transformations.
        """
        records = []

        col_names = self.combined_schema().to_arrow().names

        for row in df.sort("_id").to_dicts():
            record = {}
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
                if col not in record and col in self.default_values:
                    record[col] = self.default_values[col]

            records.append(record)

        return records


from .aa_item_ids import AAItemIds, AAItemIdsModel  # noqa: E402
from .aa_searchterms import AASearchTerms  # noqa: E402
from .activity_map import ActivityMap  # noqa: E402
from .calldrivers import Calldrivers, CalldriverModel  # noqa: E402
from .custom_reports_registry import CustomReportsRegistry, CustomReportsRegistryModel  # noqa: E402
from .gsc_searchterms import GSCSearchTerms  # noqa: E402
from .pages import Pages, PagesModel  # noqa: E402
from .pages_list import PagesList, PagesListModel  # noqa: E402
from .page_metrics import PageMetrics, PagesMetricsModel  # noqa: E402
from .projects import Projects, ProjectsModel  # noqa: E402
from .tasks import Tasks, TasksModel  # noqa: E402
from .ux_tests import UxTests, UxTestsModel  # noqa: E402
from .feedback import Feedback, FeedbackModel  # noqa: E402
from .gc_tss import GcTss, GcTssModel  # noqa: E402
from .gc_tasks_mappings import GcTasksMappings, GcTasksMappingsModel  # noqa: E402
from .overall_metrics import OverallMetrics, OverallMetricsModel  # noqa: E402
from .overall_aa_searchterms_en import OverallAASearchTermsEn  # noqa: E402
from .overall_aa_searchterms_fr import OverallAASearchTermsFr  # noqa: E402
from .overall_gsc_searchterms import OverallGSCSearchTerms  # noqa: E402
from .urls import Urls, UrlsModel  # noqa: E402
from .readability import Readability, ReadabilityModel  # noqa: E402
from .reports import Reports, ReportsModel  # noqa: E402
from .search_assessment import SearchAssessment, SearchAssessmentModel  # noqa: E402
from .annotations import Annotations, AnnotationsModel  # noqa: E402


collection_models: List[type[MongoCollection]] = [
    AnnotationsModel,
    AAItemIdsModel,
    CalldriverModel,
    CustomReportsRegistryModel,
    FeedbackModel,
    GcTssModel,
    GcTasksMappingsModel,
    OverallMetricsModel,
    PagesModel,
    PagesListModel,
    PagesMetricsModel,
    ProjectsModel,
    TasksModel,
    UrlsModel,
    UxTestsModel,
    ReadabilityModel,
    ReportsModel,
    SearchAssessmentModel,
]

__all__ = [
    "collection_models",
    "ParquetModel",
    "MongoCollection",
    "AASearchTerms",
    "AAItemIds",
    "ActivityMap",
    "Calldrivers",
    "CustomReportsRegistry",
    "Feedback",
    "GSCSearchTerms",
    "GcTss",
    "GcTasksMappings",
    "OverallMetrics",
    "OverallAASearchTermsEn",
    "OverallAASearchTermsFr",
    "OverallGSCSearchTerms",
    "PagesList",
    "Pages",
    "PageMetrics",
    "Projects",
    "Tasks",
    "Urls",
    "UxTests",
    "Readability",
    "Reports",
    "SearchAssessment",
    "Annotations",
]
