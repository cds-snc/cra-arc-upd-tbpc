from .aa_item_ids import AAItemIds, AAItemIdsModel
from .aa_searchterms import AASearchTerms
from .activity_map import ActivityMap
from .calldrivers import Calldrivers, CalldriverModel
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
from .gc_tasks_mappings import GcTasksMappings, GcTasksMappingsModel
from .overall_metrics import OverallMetrics, OverallMetricsModel
from .overall_aa_searchterms_en import OverallAASearchTermsEn
from .overall_aa_searchterms_fr import OverallAASearchTermsFr
from .overall_gsc_searchterms import OverallGSCSearchTerms
from .urls import Urls, UrlsModel
from .readability import Readability, ReadabilityModel
from .reports import Reports, ReportsModel
from .search_assessment import SearchAssessment, SearchAssessmentModel
from .annotations import Annotations, AnnotationsModel
from .lib import (
    AnyFrame,
    MongoCollection,
    ParquetModel,
    ParquetModels,
    get_parquet_models,
)


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
