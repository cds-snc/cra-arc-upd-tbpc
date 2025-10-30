from typing import TypedDict
from .lib import AnyFrame, MongoCollection, ParquetModel
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


collection_models: list[type[MongoCollection]] = [
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


ParquetModels = TypedDict(
    "ParquetModels",
    {
        "annotations": Annotations,
        "aa_item_ids": AAItemIds,
        "aa_searchterms": AASearchTerms,
        "activity_map": ActivityMap,
        "calldrivers": Calldrivers,
        "custom_reports_registry": CustomReportsRegistry,
        "feedback": Feedback,
        "gsc_searchterms": GSCSearchTerms,
        "gc_tss": GcTss,
        "gc_tasks_mappings": GcTasksMappings,
        "overall_metrics": OverallMetrics,
        "overall_aa_searchterms_en": OverallAASearchTermsEn,
        "overall_aa_searchterms_fr": OverallAASearchTermsFr,
        "overall_gsc_searchterms": OverallGSCSearchTerms,
        "pages_list": PagesList,
        "pages": Pages,
        "page_metrics": PageMetrics,
        "projects": Projects,
        "tasks": Tasks,
        "urls": Urls,
        "ux_tests": UxTests,
        "readability": Readability,
        "reports": Reports,
        "search_assessment": SearchAssessment,
    },
)


def get_parquet_models(dir_path: str | None = None) -> ParquetModels:
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


__all__ = [
    "AnyFrame",
    "collection_models",
    "ParquetModel",
    "ParquetModels",
    "get_parquet_models",
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
