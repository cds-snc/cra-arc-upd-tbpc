from typing import final, override
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import polars as pl
from mongo_parquet.schemas import (
    AnyFrame,
    MongoCollection,
    ParquetModel,
)
from pymongoarrow.api import Schema
from pyarrow import (
    float64,
    int64,
    string,
    struct,
    timestamp,
    list_,
    int32,
    bool_,
)
from pymongo.database import Database
from pymongoarrow.types import ObjectIdType
from .utils import format_timedelta, ViewsUtils
from .daterange_utils import (
    DateRange,
    DateRangeWithComparison,
    get_date_ranges_with_comparisons,

)
from ..schemas import get_parquet_models, ParquetModels
from ..utils import objectid
from ..utils_math import (
    ind_status,
    metric_flags_and_weights,
    perf_score_higher_better_0_100,
    perf_score_lower_better_0_100,
    weighted_raw_score_over_available,
)


@final
class TasksView(ParquetModel):
    schema: Schema = Schema(
        {
            "_id": ObjectIdType(),
            "dateRange": struct(
                {"start": timestamp("ms"), "end": timestamp("ms")}.items()
            ),
            "task": struct(
                {
                    "_id": ObjectIdType(),
                    "title": string(),
                    "title_fr": string(),
                    "group": string(),
                    "subgroup": string(),
                    "topic": string(),
                    "subtopic": string(),
                    "sub_subtopic": list_(string()),
                    "user_type": list_(string()),
                    "tpc_ids": list_(int32()),
                    "program": string(),
                    "service": string(),
                    "user_journey": list_(string()),
                    "status": string(),
                    "channel": list_(string()),
                    "core": list_(string()),
                    "portfolio": string(),
                    "gc_tasks": list_(
                        struct(
                            {
                                "_id": string(),
                                "airtable_id": string(),
                                "title": string(),
                                "title_fr": string(),
                                "date_mapped": timestamp("ms"),
                            }.items()
                        )
                    ),
                }.items()
            ),
            "totalCalls": int32(),
            "calldriversEnquiry": list_(
                struct(
                    {
                        "enquiry_line": string(),
                        "calls": int32(),
                    }.items()
                )
            ),
            "callsByTopic": list_(
                struct(
                    {
                        "tpc_id": int32(),
                        "enquiry_line": string(),
                        "topic": string(),
                        "subtopic": string(),
                        "sub_subtopic": string(),
                        "calls": int32(),
                    }.items()
                )
            ),
            "callsPerVisit": float64(),
            "dyfNo": int32(),
            "dyfNoPerVisit": float64(),
            "dyfYes": int32(),
            "visits": int32(),
            "gscTotalClicks": int64(),
            "gscTotalImpressions": int64(),
            "gscTotalCtr": float64(),
            "gscTotalPosition": float64(),
            "survey": int32(),
            "survey_completed": int32(),
            "tmf_ranking_index": int32(),
            "seasonal_average": float64(),
            "historical_average": float64(),
            "performance_score": float64(),
            "cops": bool_(),
            "wos_cops": bool_(),
            "numComments": int32(),
            "individualHistory": list_(
                struct(
                    {
                        "month": timestamp("ms"),
                        "individual_score": float64(),
                        "calls_per_100": float64(),
                        "neg_feedback_per_1000": float64(),
                        "survey_success_rate": float64(),
                    }.items()
                )
            ),
            "aa_searchterms": list_(
                struct(
                    {
                        "term": string(),
                        "clicks": int32(),
                        "position": float64(),
                    }.items()
                )
            ),
            "gsc_searchterms": list_(
                struct(
                    {
                        "clicks": int32(),
                        "ctr": float64(),
                        "impressions": int32(),
                        "position": float64(),
                        "term": string(),
                    }.items()
                )
            ),
            "metricsByDay": list_(
                struct(
                    {
                        "date": timestamp("ms"),
                        "calls": int32(),
                        "callsPerVisit": float64(),
                        "dyfNo": int32(),
                        "dyfNoPerVisit": float64(),
                        "dyfYes": int32(),
                        "numComments": int32(),
                        "commentsPerVisit": float64(),
                        "visits": int32(),
                    }.items()
                )
            ),
            "pages": list_(
                struct(
                    {
                        "_id": ObjectIdType(),
                        "page": struct(
                            {
                                "_id": ObjectIdType(),
                                "url": string(),
                                "title": string(),
                                "lang": string(),
                                "redirect": string(),
                                "owners": string(),
                                "sections": string(),
                            }.items()
                        ),
                        "pageStatus": string(),
                        "visits": int32(),
                        "dyf_yes": int32(),
                        "dyf_no": int32(),
                        "numComments": int32(),
                        "gsc_total_clicks": int64(),
                        "gsc_total_impressions": int64(),
                        "gsc_total_ctr": float64(),
                        "gsc_total_position": float64(),
                    }.items()
                )
            ),
            "ux_tests": list_(
                struct(
                    {
                        "_id": ObjectIdType(),
                        "title": string(),
                        "airtable_id": string(),
                        "project": ObjectIdType(),
                        "subtask": string(),
                        "date": timestamp("ms"),
                        "success_rate": float64(),
                        "test_type": string(),
                        "session_type": string(),
                        "scenario": string(),
                        "scenario_html": string(),
                        "vendor": string(),
                        "version_tested": string(),
                        "github_repo": string(),
                        "total_users": int32(),
                        "successful_users": int32(),
                        "program": string(),
                        "branch": string(),
                        "project_lead": string(),
                        "launch_date": timestamp("ms"),
                        "status": string(),
                        "cops": bool_(),
                        "wos_cops": bool_(),
                        "attachments": list_(
                            struct(
                                {
                                    "id": string(),
                                    "url": string(),
                                    "filename": string(),
                                    "size": int32(),
                                    "storage_url": string(),
                                }.items()
                            )
                        ),
                    }.items()
                )
            ),
            "projects": list_(
                struct(
                    {
                        "_id": ObjectIdType(),
                        "title": string(),
                        "description": string(),
                        "attachments": list_(
                            struct(
                                {
                                    "id": string(),
                                    "url": string(),
                                    "filename": string(),
                                    "size": int32(),
                                    "storage_url": string(),
                                }.items()
                            )
                        ),
                    }.items()
                )
            ),
            "lastUpdated": timestamp("ms"),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("task").struct.with_fields(pl.field("_id").str.decode("hex")),
            pl.col("pages").list.eval(
                pl.element().struct.with_fields(
                    pl.field("_id").str.decode("hex"),
                    pl.field("page").struct.with_fields(
                        pl.field("_id").str.decode("hex")
                    ),
                )
            ),
            pl.col("ux_tests").list.eval(
                pl.element().struct.with_fields(
                    pl.field("_id").str.decode("hex"),
                    pl.field("project").str.decode("hex"),
                    pl.field("pages").list.eval(pl.element().str.decode("hex")),
                )
            ),
            pl.col("projects").list.eval(
                pl.element().struct.with_fields(
                    pl.field("_id").str.decode("hex"),
                    pl.field("attachments").list.eval(
                        pl.element().struct.with_fields(
                            pl.field("_id").str.decode("hex"),
                        )
                    ),
                )
            ),
        )


@final
class TasksViewModel(MongoCollection):
    collection = "view_tasks"
    primary_model = TasksView()


@final
class TasksViewContext:
    def __init__(
        self,
        parquet_models: ParquetModels,
    ):
        self.parquet_models = parquet_models
        self.tasks = self.get_tasks()
        self.page_urls_enum = self.get_page_urls_enum()
        self.pages = self.get_pages()
        self.urls_by_task = self.get_urls_by_task()
        self.tasks_by_tpc_id = self.get_tasks_by_tpc_id()
        self.tasks_by_gc_task = self.get_tasks_by_gc_task()

    def get_projects_by_task(self) -> pl.LazyFrame:
        return (
            self.parquet_models["projects"]
            .lf()
            .explode("tasks")
            .group_by("tasks")
            .agg(pl.struct(pl.all()).alias("projects"))
            .rename({"tasks": "_id"})
        )

    def get_ux_tests_by_task(self) -> pl.LazyFrame:
        return (
            self.parquet_models["ux_tests"]
            .lf()
            .explode("tasks")
            .group_by("tasks")
            .agg(
                pl.struct(pl.all()).alias("ux_tests"),
                pl.col("cops").max().alias("cops"),
                pl.col("wos_cops").max().alias("wos_cops"),
            )
            .rename({"tasks": "_id"})
        )

    def get_page_urls_enum(self) -> pl.Enum:
        unique_metrics_urls = (
            self.parquet_models["page_metrics"].lf().select(pl.col("url").unique())
        )
        unique_page_urls = (
            self.parquet_models["pages"].lf().select(pl.col("url").unique())
        )
        unique_gsc_searchterms_urls = (
            self.parquet_models["gsc_searchterms"].lf().select(pl.col("url").unique())
        )
        unique_feedback_urls = (
            self.parquet_models["feedback"].lf().select(pl.col("url").unique())
        )
        unique_combined = (
            pl.concat(
                [
                    unique_metrics_urls,
                    unique_page_urls,
                    unique_gsc_searchterms_urls,
                    unique_feedback_urls,
                ]
            )
            .select(pl.col("url").unique())
            .collect()
        )

        return pl.Enum(unique_combined["url"])

    def get_tasks(self) -> pl.DataFrame:
        projects_lf = self.get_projects_by_task()
        ux_tests_lf = self.get_ux_tests_by_task()
        return (
            self.parquet_models["tasks"]
            .lf()
            .drop("projects", "ux_tests")
            .join(projects_lf, on="_id", how="left", coalesce=True)
            .join(ux_tests_lf, on="_id", how="left", coalesce=True)
            .collect()
        )

    def get_pages(self) -> pl.DataFrame:
        return (
            self.parquet_models["pages"]
            .lf()
            .with_columns(pl.col("url").cast(self.page_urls_enum))
            .collect()
        )

    def get_urls_by_task(self) -> pl.DataFrame:
        return (
            self.pages.select(
                pl.col("url").cast(self.page_urls_enum),
                pl.col("tasks"),
            )
            .explode("tasks")
            .rename({"tasks": "task"})
        )

    def get_tasks_by_tpc_id(self) -> pl.DataFrame:
        return (
            self.tasks.select(pl.col("_id"), pl.col("tpc_ids"))
            .filter(pl.col("tpc_ids").is_not_null(), pl.col("tpc_ids").list.len() > 0)
            .explode("tpc_ids")
            .group_by("tpc_ids")
            .agg(pl.col("_id").implode().alias("tasks"))
            .rename({"tpc_ids": "tpc_id"})
        )

    def get_tasks_by_gc_task(self) -> pl.DataFrame:
        return (
            self.tasks.select(
                pl.col("_id"),
                pl.col("gc_tasks")
                .list.eval(pl.element().struct.field("title"))
                .list.unique()
                .alias("gc_task"),
            )
            .filter(pl.col("gc_task").is_not_null(), pl.col("gc_task").list.len() > 0)
            .explode("gc_task")
            .group_by("gc_task")
            .agg(pl.col("_id").implode().alias("tasks"))
        )


@final
class TasksViewService:
    def __init__(self, db: Database, views_utils: ViewsUtils):
        self.mongo_model = TasksViewModel(
            db, parquet_dir_path=views_utils.parquet_dir_path
        )
        self.parquet_model = self.mongo_model.primary_model
        self.dependencies: ParquetModels = get_parquet_models(
            views_utils.parquet_dir_path
        )
        self.date_ranges_with_comparisons = get_date_ranges_with_comparisons()
        # self.date_ranges = [
        #     {"start": datetime(2024, 1, 1), "end": datetime(2025, 12, 31),},
        # ]
        self.context = TasksViewContext(
            parquet_models=self.dependencies,
        )
        self.views_utils = views_utils
        self.temp_dir = self.views_utils.temp_dir_path

    def scan_pages_view(self, date_range: DateRange) -> pl.LazyFrame:
        filename = f"view_pages_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        return self.views_utils.scan_temp(filename)

    def insert_batch(self, df: pl.DataFrame) -> bool | None:
        transformed_df = self.parquet_model.reverse_transform(df)

        rows = self.mongo_model.prepare_for_insert(transformed_df, sort_id=False)

        if len(rows) == 0:
            return

        print(f"  Writing batch of {len(df)} rows...")

        results = self.mongo_model.client.insert_many(rows, ordered=False)

        print(f"  Wrote batch: Inserted {len(results.inserted_ids)} rows")

    def recalculate_tasks_view(self):
        start_time = datetime.now()
        print(f"Recalculating tasks view at {start_time.isoformat()}")

        _ = self.mongo_model.client.delete_many({})

        self.calculate_and_write_tasks_view_files()
        self.insert_tasks_view_from_temp()

        print(
            f"Finished recalculating tasks view in {format_timedelta(datetime.now() - start_time)}"
        )

    def calculate_and_write_tasks_view_files(self):
        for dr in self.date_ranges_with_comparisons.values():  # pyright: ignore[reportAssignmentType]
            dr: DateRangeWithComparison = dr
            for date_range in [dr["date_range"], dr["comparison_date_range"]]:
                if self.views_utils.is_view_calculated(date_range):
                    print(
                        f"Skipping calculation for {date_range['start'].date()} to {date_range['end'].date()} as it was already calculated."
                    )
                    continue

                lf = self.get_view_date_range_data(date_range)

                date_range_start_time = datetime.now()
                print(
                    f"Writing tasks view for {date_range['start']} to {date_range['end']}..."
                )

                output_filename = f"view_tasks_{date_range['start'].date()}_{date_range['end'].date()}.parquet"

                self.views_utils.sink_temp(lf, output_filename)

                print(
                    f"  Finished in {format_timedelta(datetime.now() - date_range_start_time)}"
                )
                self.views_utils.set_view_calculated(date_range)

        self.views_utils.clear_already_calculated_views()

    def insert_tasks_view_from_temp(self):
        for dr in self.date_ranges_with_comparisons.values():  # pyright: ignore[reportAssignmentType]
            dr: DateRangeWithComparison = dr
            for date_range in [dr["date_range"], dr["comparison_date_range"]]:
                if self.views_utils.is_view_inserted(date_range):
                    print(
                        f"Skipping insertion for {date_range['start'].date()} to {date_range['end'].date()} as it was already inserted."
                    )
                    continue

                date_range_start_time = datetime.now()
                print(
                    f"Inserting tasks view for {date_range['start']} to {date_range['end']}..."
                )

                filename = f"view_tasks_{date_range['start'].date()}_{date_range['end'].date()}.parquet"

                self.views_utils.scan_temp(filename).sink_batches(
                    self.insert_batch, chunk_size=1_000, lazy=False
                )

                print(
                    f"  Finished in {format_timedelta(datetime.now() - date_range_start_time)}"
                )
                self.views_utils.set_view_inserted(date_range)

        self.views_utils.clear_already_inserted_views()

    def get_view_date_range_data(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        self.write_temp_aa_searchterms(date_range)
        self.write_temp_gsc_searchterms(date_range)
        self.write_temp_metrics_by_day(date_range)
        self.write_temp_individual_history_for_date_range(date_range)

        top_level_metrics = self.get_top_level_metrics(date_range)

        aa_search_terms = self.get_aa_searchterms(date_range)

        gsc_search_terms = self.get_gsc_searchterms(date_range)

        metrics_by_day = self.get_metrics_by_day(date_range)

        pages = self.get_pages(date_range)

        gc_task_metrics = self.get_gc_task_metrics(date_range)

        performance_scores = self.get_performance_scores_for_date_range(date_range)

        performance_history = self.get_individual_history(date_range)

        seasonal_average = self.get_seasonal_average_for_date_range(date_range)

        num_tasks = self.context.tasks.height

        doc_ids = [str(objectid()) for _ in range(num_tasks)]

        id_series = pl.Series("_id", doc_ids)

        view_data = (
            self.context.tasks.lazy()
            .select(
                id_series.alias("_doc_id"),
                pl.col("_id"),
                pl.struct(pl.all().exclude("pages", "projects", "ux_tests")).alias(
                    "task"
                ),
                pl.col("projects"),
                pl.col("ux_tests"),
                pl.lit(date_range).alias("dateRange"),
                pl.lit(datetime.now()).alias("lastUpdated"),
            )
            .join(
                top_level_metrics,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                aa_search_terms,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                gsc_search_terms,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                metrics_by_day,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                pages,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                gc_task_metrics,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                performance_scores,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                performance_history,
                on="_id",
                how="left",
                coalesce=True,
            )
            .join(
                seasonal_average,
                on="_id",
                how="left",
                coalesce=True,
            )
            .drop("_id")
            .rename({"_doc_id": "_id"})
            .with_columns(
                pl.col("dyfNo").fill_null(0),
                pl.col("dyfYes").fill_null(0),
                pl.col("numComments").fill_null(0),
                pl.col("gscTotalClicks").fill_null(0),
                pl.col("gscTotalImpressions").fill_null(0),
                pl.col("visits").fill_null(0),
                pl.col("totalCalls").fill_null(0),
                pl.col("callsPerVisit").fill_null(0.0),
                pl.col("survey").fill_null(0),
                pl.col("survey_completed").fill_null(0),
            )
        )

        return self.add_tmf_ranking_index(view_data)

    def get_top_level_metrics(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        page_metrics_lf = (
            self.scan_pages_view(date_range)
            .select(
                [
                    "tasks",
                    "dyf_no",
                    "dyf_yes",
                    "visits",
                    "gsc_total_clicks",
                    "gsc_total_impressions",
                    "gsc_total_ctr",
                    "gsc_total_position",
                    "numComments",
                ]
            )
            .explode("tasks")
            .group_by("tasks")
            .agg(
                pl.col("dyf_no").sum().alias("dyfNo"),
                pl.col("dyf_yes").sum().alias("dyfYes"),
                pl.col("visits").sum(),
                pl.col("numComments").sum(),
                pl.col("gsc_total_clicks").sum().alias("gscTotalClicks"),
                pl.col("gsc_total_impressions").sum().alias("gscTotalImpressions"),
                pl.col("gsc_total_position").mean().round(5).alias("gscTotalPosition"),
                pl.col("gsc_total_ctr").mean().round(5).alias("gscTotalCtr"),
            )
            .with_columns(
                pl.when(pl.col("visits") == pl.lit(0))
                .then(pl.lit(None))
                .otherwise((pl.col("dyfNo") / pl.col("visits")).round_sig_figs(8))
                .alias("dyfNoPerVisit"),
            )
            .rename({"tasks": "_id"})
        )

        calls_by_topic_lf = (
            self.dependencies["calldrivers"]
            .lf()
            .select(
                pl.col("date"),
                pl.col("tpc_id"),
                pl.col("enquiry_line"),
                pl.col("topic"),
                pl.col("subtopic"),
                pl.col("sub_subtopic"),
                pl.col("calls"),
            )
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .group_by("tpc_id")
            .agg(
                pl.col("enquiry_line").first().alias("enquiry_line"),
                pl.col("topic").first().alias("topic"),
                pl.col("subtopic").first().alias("subtopic"),
                pl.col("sub_subtopic").first().alias("sub_subtopic"),
                pl.col("calls").sum().alias("calls"),
            )
            .join(
                self.context.tasks_by_tpc_id.lazy(),
                on="tpc_id",
                how="inner",
                coalesce=True,
            )
            .explode("tasks")
            .rename({"tasks": "_id"})
        )

        calls_by_enquiry_line_lf = (
            calls_by_topic_lf.group_by("_id", "enquiry_line")
            .agg(pl.col("calls").sum())
            .group_by("_id")
            .agg(
                pl.struct(
                    pl.col("enquiry_line"),
                    pl.col("calls"),
                )
                .implode()
                .alias("calldriversEnquiry")
            )
        )

        total_calls_lf = calls_by_topic_lf.group_by("_id").agg(
            pl.col("calls").sum().alias("totalCalls")
        )

        calls_by_topic_join_lf = calls_by_topic_lf.group_by("_id").agg(
            pl.struct(
                pl.col("tpc_id"),
                pl.col("enquiry_line"),
                pl.col("topic"),
                pl.col("subtopic"),
                pl.col("sub_subtopic"),
                pl.col("calls"),
            )
            .implode()
            .alias("callsByTopic")
        )

        return (
            page_metrics_lf.join(
                total_calls_lf, on="_id", how="full", coalesce=True, validate="1:1"
            )
            .join(calls_by_enquiry_line_lf, on="_id", how="full", coalesce=True)
            .join(calls_by_topic_join_lf, on="_id", how="full", coalesce=True)
            .with_columns(
                pl.when(pl.col("visits") == pl.lit(0))
                .then(pl.lit(None))
                .otherwise((pl.col("totalCalls") / pl.col("visits")).round(6))
                .alias("callsPerVisit"),
            )
        )

    def get_gc_task_metrics(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        # logic from gc-tasks.schema.ts->getTotalEntries()
        gc_task_metrics = (
            self.dependencies["gc_tss"]
            .lf()
            .select(
                pl.col("date"),
                pl.col("gc_task"),
                pl.col("sampling_task"),
                pl.col("able_to_complete"),
            )
            .filter(
                pl.col("date").is_between(date_range["start"], date_range["end"]),
                pl.col("sampling_task").eq("y"),
                pl.col("able_to_complete").is_in(["Yes", "No"]),
            )
            .group_by("gc_task")
            .agg(
                pl.len().alias("survey"),  # aka `gc_survey_participants`
                pl.col("able_to_complete")
                .eq("Yes")
                .sum()
                .alias("survey_completed"),  # aka `gc_survey_completed`
            )
        )

        return (
            gc_task_metrics.join(
                self.context.tasks_by_gc_task.lazy(),
                left_on="gc_task",
                right_on="gc_task",
                how="inner",
                coalesce=True,
            )
            .explode("tasks")
            .group_by("tasks")
            .agg(
                pl.col("survey").sum(),
                pl.col("survey_completed").sum(),
            )
            .rename({"tasks": "_id"})
        )

    def write_temp_aa_searchterms(
        self,
        date_range: DateRange,
    ):
        aa_searchterms = (
            self.scan_pages_view(date_range)
            .filter(
                pl.col("tasks").is_not_null(), pl.col("aa_searchterms").is_not_null()
            )
            .select(
                pl.col("tasks"),
                pl.col("aa_searchterms"),
            )
            .explode("tasks")
            .explode("aa_searchterms")
            .rename({"tasks": "_id"})
            .select("_id", pl.col("aa_searchterms").struct.unnest())
            .group_by("_id", "term")
            .agg(
                pl.col("clicks").sum(),
                pl.col("position").mean().round(4),
            )
            .group_by("_id")
            .agg(pl.struct(pl.all().top_k_by("clicks", 100)).alias("aa_searchterms"))
        )

        filename = f"tasks_aa_searchterms_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        self.views_utils.sink_temp(aa_searchterms, filename)

    def get_aa_searchterms(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        filename = f"tasks_aa_searchterms_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        return self.views_utils.scan_temp(filename)

    def write_temp_gsc_searchterms(
        self,
        date_range: DateRange,
    ):
        gsc_searchterms = (
            self.scan_pages_view(date_range)
            .select(
                pl.col("tasks"),
                pl.col("gsc_searchterms"),
            )
            .explode("tasks")
            .explode("gsc_searchterms")
            .select(
                pl.col("tasks").alias("_id"),
                pl.col("gsc_searchterms").struct.unnest(),
            )
            .group_by("_id", "term")
            .agg(
                pl.col("clicks").sum(),
                pl.col("ctr").mean().round(4),
                pl.col("impressions").sum(),
                pl.col("position").mean().round(4),
            )
            .filter(pl.col("term").is_not_null())
            .group_by("_id")
            .agg(pl.struct(pl.all().top_k_by("clicks", 100)).alias("gsc_searchterms"))
        )

        filename = f"tasks_gsc_searchterms_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        self.views_utils.sink_temp(gsc_searchterms, filename)
        
    def write_temp_individual_history_for_date_range(
        self,
        date_range: DateRange,
    ):
        period_start = date_range["start"]

        anchor_month_start = (
            datetime(period_start.year, period_start.month, 1)
            - relativedelta(months=1)
        )

        history_month_starts = [
            anchor_month_start - relativedelta(months=i)
            for i in range(23, -1, -1)
        ]

        overall_start = history_month_starts[0] - relativedelta(years=2)
        overall_end = (anchor_month_start + relativedelta(months=1)) - timedelta(days=1)

        history_range: DateRange = {
            "start": overall_start,
            "end": overall_end,
        }

        by_month_lf = self.build_task_metrics_by_month(history_range)

        by_month_filename = (
            f"tasks_individual_history_by_month_"
            f"{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        )
        self.views_utils.sink_temp(by_month_lf, by_month_filename)
        by_month_lf = self.views_utils.scan_temp(by_month_filename)

        benchmark_bundle = self.get_performance_benchmark_bundle()

        monthly_lfs: list[pl.LazyFrame] = []

        for month_start in history_month_starts:
            period_lf = (
                by_month_lf
                .filter(pl.col("month") == pl.lit(month_start))
                .select(
                    "_id",
                    "visits",
                    "calls",
                    "dyfNo",
                    "survey",
                    "survey_completed",
                    "calls_per_100",
                    "neg_feedback_per_1000",
                    "survey_success_rate",
                )
            )

            monthly_lf = (
                self.score_with_performance_benchmarks(
                    period_lf=period_lf,
                    benchmark_bundle=benchmark_bundle,
                    score_col="individual_score",
                    insufficient_col="individual_insufficient_data",
                )
                .select(
                    pl.col("_id"),
                    pl.lit(month_start).alias("month"),
                    pl.col("individual_score"),
                    pl.col("calls_per_100"),
                    pl.col("neg_feedback_per_1000"),
                    pl.col("survey_success_rate"),
                )
            )

            monthly_lfs.append(monthly_lf)

        combined = pl.concat(monthly_lfs)

        final_lf = (
            combined
            .sort(["_id", "month"])
            .group_by("_id")
            .agg(
                pl.struct(
                    "month",
                    "individual_score",
                    "calls_per_100",
                    "neg_feedback_per_1000",
                    "survey_success_rate",
                ).alias("individualHistory"),
                pl.col("individual_score").mean().alias("historical_average"),
            )
        )

        final_filename = (
            f"tasks_individual_history_"
            f"{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        )

        self.views_utils.sink_temp(final_lf, final_filename)
        
    def get_individual_history(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        filename = (
            f"tasks_individual_history_"
            f"{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        )
        return self.views_utils.scan_temp(filename)

    def get_gsc_searchterms(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        filename = f"tasks_gsc_searchterms_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        return self.views_utils.scan_temp(filename)

    def _build_task_day_base(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        metrics_by_day = (
            self.dependencies["page_metrics"]
            .lf()
            .select(
                pl.col("date"),
                pl.col("url").cast(self.context.page_urls_enum),
                pl.col("visits"),
                pl.col("dyf_no"),
                pl.col("dyf_yes"),
            )
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .group_by("date", "url")
            .agg(
                pl.col("visits").sum().alias("visits"),
                pl.col("dyf_no").sum().alias("dyf_no"),
                pl.col("dyf_yes").sum().alias("dyf_yes"),
            )
            .join(
                self.context.urls_by_task.lazy(), on="url", how="inner", coalesce=True
            )
            .group_by("task", "date")
            .agg(
                pl.col("visits").sum().alias("visits"),
                pl.col("dyf_no").sum().alias("dyf_no"),
                pl.col("dyf_yes").sum().alias("dyf_yes"),
            )
            .rename({"task": "_id"})
        )

        calls_by_day = (
            self.dependencies["calldrivers"]
            .lf()
            .select(pl.col("date"), pl.col("tpc_id"), pl.col("calls"))
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .group_by("tpc_id", "date")
            .agg(pl.col("calls").sum().alias("calls"))
            .join(
                self.context.tasks_by_tpc_id.lazy(),
                on="tpc_id",
                how="inner",
                coalesce=True,
            )
            .explode("tasks")
            .group_by("tasks", "date")
            .agg(pl.col("calls").sum().alias("calls"))
            .rename({"tasks": "_id"})
        )

        combined_sparse = metrics_by_day.join(
            calls_by_day, on=["_id", "date"], how="full", coalesce=True
        )

        dates_lf = pl.LazyFrame(
            {
                "date": pl.datetime_range(
                    date_range["start"],
                    date_range["end"],
                    interval="1d",
                    eager=True,
                    time_unit="ms",
                )
            }
        )

        tasks_lf = self.context.tasks.lazy().select(pl.col("_id"))

        return (
            tasks_lf.join(dates_lf, how="cross", maintain_order="right")
            .sort(["_id", "date"])
            .join(combined_sparse, on=["_id", "date"], how="left", coalesce=True)
            .with_columns(
                pl.col("visits").fill_null(0),
                pl.col("dyf_no").fill_null(0),
                pl.col("dyf_yes").fill_null(0),
                pl.col("calls").fill_null(0),
            )
        )

    def write_temp_metrics_by_day(self, date_range: DateRange):
        base = self._build_task_day_base(date_range)

        num_comments_by_page = (
            self.dependencies["feedback"]
            .lf()
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .select("date", pl.col("url").cast(self.context.page_urls_enum))
            .group_by("date", "url")
            .agg(pl.len().alias("numComments"))
        )

        num_comments_by_task = (
            self.context.urls_by_task.lazy()
            .join(num_comments_by_page, on="url", how="inner", coalesce=True)
            .group_by("task", "date")
            .agg(pl.col("numComments").sum().alias("numComments"))
            .rename({"task": "_id"})
        )

        full_by_day = (
            base.join(
                num_comments_by_task, on=["_id", "date"], how="left", coalesce=True
            )
            .with_columns(pl.col("numComments").fill_null(0))
            .with_columns(
                pl.when(pl.col("visits") == 0)
                .then(None)
                .otherwise((pl.col("dyf_no") / pl.col("visits")).round_sig_figs(8))
                .alias("dyfNoPerVisit"),
                pl.when(pl.col("visits") == 0)
                .then(None)
                .otherwise((pl.col("calls") / pl.col("visits")).round_sig_figs(8))
                .alias("callsPerVisit"),
                pl.when(pl.col("visits") == 0)
                .then(None)
                .otherwise((pl.col("numComments") / pl.col("visits")).round_sig_figs(8))
                .alias("commentsPerVisit"),
            )
            .group_by("_id")
            .agg(pl.struct(pl.all().exclude("_id")).alias("metricsByDay"))
            .with_columns(
                pl.col("metricsByDay").list.eval(
                    pl.element().sort_by(pl.element().struct.field("date"))
                )
            )
        )

        filename = f"tasks_metrics_by_day_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        self.views_utils.sink_temp(full_by_day, filename)

    def get_metrics_by_day(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        filename = f"tasks_metrics_by_day_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        return self.views_utils.scan_temp(filename)

    def get_pages(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        return (
            self.scan_pages_view(date_range)
            .select(
                [
                    "_id",
                    pl.col("page").struct.with_fields(pl.field("url").cast(pl.String)),
                    "tasks",
                    "pageStatus",
                    pl.col("visits").fill_null(0),
                    pl.col("dyf_yes").fill_null(0),
                    pl.col("dyf_no").fill_null(0),
                    pl.col("numComments").fill_null(0),
                    pl.col("gsc_total_clicks").fill_null(0),
                    pl.col("gsc_total_impressions").fill_null(0),
                    "gsc_total_ctr",
                    "gsc_total_position",
                ]
            )
            .explode("tasks")
            .select(
                pl.col("tasks").alias("_id"),
                pl.struct(pl.all().exclude("tasks")).alias("pages"),
            )
            .group_by("_id")
            .agg(pl.col("pages").implode())
        )

    def add_tmf_ranking_index(
        self,
        lf: pl.LazyFrame,
    ) -> pl.LazyFrame:
        return lf.with_columns(
            (
                (pl.col("visits") * pl.lit(0.1, dtype=pl.Float64))
                + (pl.col("totalCalls") * pl.lit(0.6, dtype=pl.Float64))
                + (pl.col("survey") * pl.lit(0.3, dtype=pl.Float64))
            )
            .round(5)
            .alias("tmf_ranking_index")
        )

    def two_year_benchmark_window(self, period_start: datetime) -> DateRange:
        bench_end = period_start - timedelta(days=1)
        bench_start = period_start - relativedelta(years=2)
        return {"start": bench_start, "end": bench_end}

    def build_task_metrics_by_day(self, history_range: DateRange) -> pl.LazyFrame:
        base = self._build_task_day_base(history_range).select(
            "_id", "date", "visits", "dyf_no", "calls"
        )

        surveys_by_day = (
            self.dependencies["gc_tss"]
            .lf()
            .select("date", "gc_task", "sampling_task", "able_to_complete")
            .filter(
                pl.col("date").is_between(history_range["start"], history_range["end"])
            )
            .filter(
                pl.col("sampling_task") == "y",
                pl.col("able_to_complete").is_in(["Yes", "No"]),
            )
            .group_by("gc_task", "date")
            .agg(
                pl.len().alias("survey"),
                pl.col("able_to_complete").eq("Yes").sum().alias("survey_completed"),
            )
            .join(
                self.context.tasks_by_gc_task.lazy(),
                on="gc_task",
                how="inner",
                coalesce=True,
            )
            .explode("tasks")
            .group_by("tasks", "date")
            .agg(
                pl.col("survey").sum(),
                pl.col("survey_completed").sum(),
            )
            .rename({"tasks": "_id"})
        )

        return base.join(
            surveys_by_day, on=["_id", "date"], how="left", coalesce=True
        ).with_columns(
            pl.col("survey").fill_null(0),
            pl.col("survey_completed").fill_null(0),
        )

    def get_rate_exprs_for_scoring(self) -> list[pl.Expr]:
        return [
            pl.when(pl.col("visits") > 0)
            .then(pl.col("calls") / pl.col("visits") * 100.0)
            .otherwise(None)
            .alias("calls_per_100"),

            pl.when(pl.col("visits") > 0)
            .then(pl.col("dyfNo") / pl.col("visits") * 1000.0)
            .otherwise(None)
            .alias("neg_feedback_per_1000"),

            # fraction 0..1 (matches Excel sheet values like 0.80..1.00)
            pl.when(pl.col("survey") > 0)
            .then(pl.col("survey_completed") / pl.col("survey"))
            .otherwise(None)
            .alias("survey_success_rate"),
        ]

    def aggregate_period_from_by_day(
        self,
        by_day_lf: pl.LazyFrame,
        *,
        period_start: datetime,
        period_end: datetime,
    ) -> pl.LazyFrame:
        return (
            by_day_lf.filter(pl.col("date").is_between(period_start, period_end))
            .group_by("_id")
            .agg(
                pl.col("visits").sum().alias("visits"),
                pl.col("calls").sum().alias("calls"),
                pl.col("dyf_no").sum().alias("dyfNo"),
                pl.col("survey").sum().alias("survey"),
                pl.col("survey_completed").sum().alias("survey_completed"),
            )
            .with_columns(*self.get_rate_exprs_for_scoring())
        )

    def score_period_rows(
        self,
        *,
        period_lf: pl.LazyFrame,
    ) -> pl.LazyFrame:
        return (
            self.score_with_performance_benchmarks(
                period_lf=period_lf,
                benchmark_bundle=self.get_performance_benchmark_bundle(),
                score_col="performance_score",
                insufficient_col="performance_insufficient_data",
            )
            .select(
                "_id",
                "performance_score",
            )
        )

    def get_performance_scores_for_date_range(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        period_start, period_end = date_range["start"], date_range["end"]
        bench_range = self.two_year_benchmark_window(period_start)

        history_range: DateRange = {
            "start": bench_range["start"],
            "end": period_end,
        }

        by_day_lf = self.build_task_metrics_by_day(history_range)

        period_lf = self.aggregate_period_from_by_day(
            by_day_lf,
            period_start=period_start,
            period_end=period_end,
        )

        scored_lf = self.score_period_rows(
            period_lf=period_lf,
        )

        return scored_lf.select(
            pl.col("_id"),
            "performance_score",
        )
    
    def build_task_metrics_by_month(
        self,
        history_range: DateRange,
    ) -> pl.LazyFrame:
        return (
            self.build_task_metrics_by_day(history_range)
            .with_columns(
                pl.col("date").dt.truncate("1mo").alias("month")
            )
            .group_by(["_id", "month"])
            .agg(
                pl.col("visits").sum().alias("visits"),
                pl.col("calls").sum().alias("calls"),
                pl.col("dyf_no").sum().alias("dyfNo"),
                pl.col("survey").sum().alias("survey"),
                pl.col("survey_completed").sum().alias("survey_completed"),
            )
            .with_columns(*self.get_rate_exprs_for_scoring())
        )
    
    def get_performance_benchmark_bundle(
        self,
        survey_benchmark: float = 0.80,
        survey_ceiling: float = 1.00,
        fixed_calls_bench: float = 8.62,
        fixed_calls_ceil: float = 31.80,
        fixed_feedback_bench: float = 5.91,
        fixed_feedback_ceil: float = 21.54,
    ) -> pl.LazyFrame:
        return pl.LazyFrame(
            {
                "perf_bench_calls_per_100": [fixed_calls_bench],
                "perf_ceil_calls_per_100": [fixed_calls_ceil],
                "perf_bench_neg_feedback_per_1000": [fixed_feedback_bench],
                "perf_ceil_neg_feedback_per_1000": [fixed_feedback_ceil],
                "perf_bench_survey_success_rate": [survey_benchmark],
                "perf_ceil_survey_success_rate": [survey_ceiling],
            }
        )
    

    def score_with_performance_benchmarks(
        self,
        *,
        period_lf: pl.LazyFrame,
        benchmark_bundle: pl.LazyFrame,
        score_col: str,
        status_col: str | None = None,
        insufficient_col: str = "insufficient_data",
        w_calls: float = 0.3,
        w_feedback: float = 0.4,
        w_survey: float = 0.3,
    ) -> pl.LazyFrame:
        lf = (
            period_lf.join(benchmark_bundle, how="cross")
            .with_columns(
                *metric_flags_and_weights(
                    w_calls=w_calls,
                    w_feedback=w_feedback,
                    w_survey=w_survey,
                )
            )
            .with_columns(
                (pl.col("_metric_count") < 2).alias(insufficient_col),
            )
            .with_columns(
                perf_score_lower_better_0_100(
                    pl.col("calls_per_100"),
                    pl.col("perf_bench_calls_per_100"),
                    pl.col("perf_ceil_calls_per_100"),
                ).alias("_score_calls"),
                perf_score_lower_better_0_100(
                    pl.col("neg_feedback_per_1000"),
                    pl.col("perf_bench_neg_feedback_per_1000"),
                    pl.col("perf_ceil_neg_feedback_per_1000"),
                ).alias("_score_feedback"),
                perf_score_higher_better_0_100(
                    pl.col("survey_success_rate"),
                    pl.col("perf_bench_survey_success_rate"),
                    pl.col("perf_ceil_survey_success_rate"),
                ).alias("_score_survey"),
            )
            .with_columns(
                pl.when(pl.col(insufficient_col))
                .then(None)
                .otherwise(
                    weighted_raw_score_over_available(
                        pl.col("_score_calls"),
                        pl.col("_score_feedback"),
                        pl.col("_score_survey"),
                        w_calls=w_calls,
                        w_feedback=w_feedback,
                        w_survey=w_survey,
                    )
                    / 100.0
                )
                .alias(score_col),
                pl.when(pl.col(insufficient_col))
                .then(None)
                .otherwise(pl.col("calls_per_100"))
                .alias("calls_per_100"),
                pl.when(pl.col(insufficient_col))
                .then(None)
                .otherwise(pl.col("neg_feedback_per_1000"))
                .alias("neg_feedback_per_1000"),
                pl.when(pl.col(insufficient_col))
                .then(None)
                .otherwise(pl.col("survey_success_rate"))
                .alias("survey_success_rate"),
            )
        )

        if status_col is not None:
            lf = lf.with_columns(
                ind_status(
                    pl.when(pl.col(score_col).is_not_null())
                    .then(pl.col(score_col) * 10.0)
                    .otherwise(None)
                ).alias(status_col)
            )

        return lf
    
    def get_seasonal_average_for_date_range(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        historical_ranges: list[DateRange] = [
            {
                "start": date_range["start"] - relativedelta(years=1),
                "end": date_range["end"] - relativedelta(years=1),
            },
            {
                "start": date_range["start"] - relativedelta(years=2),
                "end": date_range["end"] - relativedelta(years=2),
            },
        ]

        history_range: DateRange = {
            "start": historical_ranges[-1]["start"],
            "end": historical_ranges[0]["end"],
        }

        by_day_lf = self.build_task_metrics_by_day(history_range)
        benchmark_bundle = self.get_performance_benchmark_bundle()

        seasonal_lfs: list[pl.LazyFrame] = []

        for historical_range in historical_ranges:
            period_lf = self.aggregate_period_from_by_day(
                by_day_lf,
                period_start=historical_range["start"],
                period_end=historical_range["end"],
            )

            seasonal_lfs.append(
                self.score_with_performance_benchmarks(
                    period_lf=period_lf,
                    benchmark_bundle=benchmark_bundle,
                    score_col="seasonal_score",
                    insufficient_col="seasonal_insufficient_data",
                ).select(
                    "_id",
                    "seasonal_score",
                )
            )

        return (
            pl.concat(seasonal_lfs)
            .group_by("_id")
            .agg(
                pl.col("seasonal_score").mean().alias("seasonal_average")
            )
        )