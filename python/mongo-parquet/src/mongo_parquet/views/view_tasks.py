from typing import final, override
from datetime import datetime
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
            "cops": bool_(),
            "numComments": int32(),
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
                .alias("gc_task"),
            )
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

    def insert_tasks_view_from_temp(self):
        for dr in self.date_ranges_with_comparisons.values():  # pyright: ignore[reportAssignmentType]
            dr: DateRangeWithComparison = dr
            for date_range in [dr["date_range"], dr["comparison_date_range"]]:
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

    def get_view_date_range_data(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        self.write_temp_aa_searchterms(date_range)
        self.write_temp_gsc_searchterms(date_range)
        self.write_temp_metrics_by_day(date_range)

        top_level_metrics = self.get_top_level_metrics(date_range)

        aa_search_terms = self.get_aa_searchterms(date_range)

        gsc_search_terms = self.get_gsc_searchterms(date_range)

        metrics_by_day = self.get_metrics_by_day(date_range)

        pages = self.get_pages(date_range)

        gc_task_metrics = self.get_gc_task_metrics(date_range)

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

    def get_gsc_searchterms(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        filename = f"tasks_gsc_searchterms_{date_range['start'].date()}_{date_range['end'].date()}.parquet"
        return self.views_utils.scan_temp(filename)

    def write_temp_metrics_by_day(
        self,
        date_range: DateRange,
    ):
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
            .join(
                num_comments_by_page,
                on="url",
                how="inner",
                coalesce=True,
            )
            .group_by("task", "date")
            .agg(pl.col("numComments").sum().alias("numComments"))
            .rename({"task": "_id"})
            .sort(["_id", "date"])
        )

        calls_by_day = (
            self.dependencies["calldrivers"]
            .lf()
            .select(
                pl.col("date"),
                pl.col("tpc_id"),
                pl.col("calls"),
            )
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .group_by("tpc_id", "date")
            .agg(
                pl.col("calls").sum().alias("calls"),
            )
            .join(
                self.context.tasks_by_tpc_id.lazy(),
                on="tpc_id",
                how="inner",
                coalesce=True,
            )
            .explode("tasks")
            .group_by("tasks", "date")
            .agg(pl.col("calls").sum())
            .rename({"tasks": "_id"})
            .sort(["_id", "date"])
        )

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
                self.context.urls_by_task.lazy(),
                on="url",
                how="inner",
                coalesce=True,
            )
            .group_by("task", "date")
            .agg(
                pl.col("visits").sum().fill_null(0),
                pl.col("dyf_no").sum().fill_null(0),
                pl.col("dyf_yes").sum().fill_null(0),
            )
            .with_columns(
                pl.when(pl.col("visits") == pl.lit(0))
                .then(pl.lit(None))
                .otherwise((pl.col("dyf_no") / pl.col("visits")).round_sig_figs(8))
                .alias("dyfNoPerVisit"),
            )
            .rename({"task": "_id"})
            .sort(["_id", "date"])
        )

        combined_by_day = metrics_by_day.join(
            calls_by_day, on=["_id", "date"], how="full", coalesce=True
        ).join(num_comments_by_task, on=["_id", "date"], how="full", coalesce=True)

        # to make sure all dates are present
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

        full_by_day = (
            self.context.tasks.lazy()
            .select(pl.col("_id"))
            .join(dates_lf, how="cross", maintain_order="right")
            .sort(by=["_id", "date"])
            .join(combined_by_day, on=["_id", "date"], how="left", coalesce=True)
            .with_columns(
                pl.col("calls").fill_null(0),
                pl.col("numComments").fill_null(0),
                pl.col("visits").fill_null(0),
                pl.col("dyf_no").fill_null(0),
                pl.col("dyf_yes").fill_null(0),
            )
            .with_columns(
                pl.when(pl.col("visits") == pl.lit(0))
                .then(pl.lit(None))
                .otherwise((pl.col("numComments") / pl.col("visits")).round_sig_figs(8))
                .alias("commentsPerVisit"),
                pl.when(pl.col("visits") == pl.lit(0))
                .then(pl.lit(None))
                .otherwise((pl.col("calls") / pl.col("visits")).round_sig_figs(8))
                .alias("callsPerVisit"),
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
