from datetime import datetime
from typing import Any, final, override
import polars as pl
from pyarrow import float64, string, struct, timestamp, list_, int32
from pymongo.database import Database
from pymongoarrow.api import Schema
from pymongoarrow.types import ObjectIdType
from .metrics_common import (
    metrics_common_schema,
    metrics_common_top_level_aggregations_expr,
)
from .daterange_utils import (
    DateRange,
    DateRangeWithComparison,
    get_date_ranges_with_comparisons,
)
from ..schemas import (
    AnyFrame,
    MongoCollection,
    ParquetModel,
)
from ..schemas import get_parquet_models, ParquetModels
from .utils import format_timedelta, ViewsUtils
from ..utils import objectid


class PagesView(ParquetModel):
    collection: str = "view_pages"
    parquet_filename: str = "view_pages.parquet"
    filter: dict[str, Any] | None = {}
    projection: dict[str, Any] | None = None
    schema: Schema = Schema(
        {
            "_id": ObjectIdType(),
            "daterange": struct(
                {"start": timestamp("ms"), "end": timestamp("ms")}.items()
            ),
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
            **metrics_common_schema,
            "pageStatus": string(),
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
            "activity_map": list_(
                struct(
                    {
                        "link": string(),
                        "clicks": int32(),
                    }.items()
                )
            ),
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "lastUpdated": timestamp("ms"),
        }
    )

    @override
    def transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").struct.with_fields(pl.field("_id").bin.encode("hex")),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
        )

    @override
    def reverse_transform(self, df: AnyFrame) -> AnyFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").struct.with_fields(pl.field("_id").str.decode("hex")),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
        )


@final
class PagesViewModel(MongoCollection):
    collection = "view_pages"
    primary_model = PagesView()


@final
class PagesViewContext:
    def __init__(
        self,
        parquet_models: ParquetModels,
    ):
        self.parquet_models: ParquetModels = parquet_models
        self.page_urls_enum = self.get_page_urls_enum()
        self.pages = self.get_pages()
        self.activity_map_links_enum = self.get_activity_map_links_enum()

    def get_pages(self) -> pl.LazyFrame:
        return (
            self.parquet_models["pages"]
            .lf()
            .select(
                [
                    pl.col("_id"),
                    pl.col("url").cast(self.page_urls_enum),
                    pl.col("title"),
                    pl.col("lang"),
                    pl.when(pl.col.is_404)
                    .then(pl.lit("404"))
                    .otherwise(
                        pl.when(pl.col.redirect.is_not_null())
                        .then(pl.lit("Redirected"))
                        .otherwise(pl.lit("Live"))
                    )
                    .alias("pageStatus"),
                    pl.col("redirect"),
                    pl.col("owners"),
                    pl.col("sections"),
                    pl.col("tasks"),
                    pl.col("projects"),
                ]
            )
            .sort("url")
        )

    def get_activity_map_links_enum(self) -> pl.Enum:
        unique_links = (
            self.parquet_models["activity_map"]
            .lf()
            .select(pl.col("link").unique())
            .collect()
        )

        return pl.Enum(unique_links["link"])

    def get_page_urls_enum(self) -> pl.Enum:
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
        unique_combined = (
            pl.concat(
                [
                    unique_metrics_urls,
                    unique_page_urls,
                    unique_activity_map_urls,
                    unique_gsc_searchterms_urls,
                    unique_feedback_urls,
                ]
            )
            .select(pl.col("url").unique())
            .collect()
        )

        return pl.Enum(unique_combined["url"])


@final
class PagesViewService:
    def __init__(self, db: Database, views_utils: ViewsUtils):
        self.mongo_model = PagesViewModel(
            db, parquet_dir_path=views_utils.parquet_dir_path
        )
        self.parquet_model = self.mongo_model.primary_model
        self.dependencies: ParquetModels = get_parquet_models(
            views_utils.parquet_dir_path
        )
        self.date_ranges_with_comparisons = get_date_ranges_with_comparisons()
        self.context = PagesViewContext(
            parquet_models=self.dependencies,
        )
        self.views_utils = views_utils
        self.temp_dir = self.views_utils.temp_dir_path

    def insert_batch(self, df: pl.DataFrame) -> bool | None:
        transformed_df = self.parquet_model.reverse_transform(df)

        rows = self.mongo_model.prepare_for_insert(transformed_df, sort_id=False)

        if len(rows) == 0:
            return

        print(f"  Writing batch of {len(df)} rows...")

        results = self.mongo_model.client.insert_many(rows, ordered=False)

        print(f"  Wrote batch: Inserted {len(results.inserted_ids)} rows")

    def recalculate_pages_view(self):
        start_time = datetime.now()
        print(f"Recalculating pages view at {start_time.isoformat()}")

        _ = self.mongo_model.client.delete_many({})

        self.calculate_and_write_pages_view_files()
        self.insert_pages_view_from_temp()

        print(
            f"Finished recalculating pages view in {format_timedelta(datetime.now() - start_time)}"
        )

    def calculate_and_write_pages_view_files(self):
        for dr in self.date_ranges_with_comparisons.values():  # pyright: ignore[reportAssignmentType]
            dr: DateRangeWithComparison = dr
            for date_range in [dr["date_range"], dr["comparison_date_range"]]:
                lf = self.get_view_date_range_data(date_range)

                date_range_start_time = datetime.now()
                print(
                    f"Writing pages view for {date_range['start']} to {date_range['end']}..."
                )

                output_filename = f"view_pages_{date_range['start'].date()}_{date_range['end'].date()}.parquet"

                self.views_utils.sink_temp(lf, output_filename)

                print(
                    f"  Finished in {format_timedelta(datetime.now() - date_range_start_time)}"
                )

    def insert_pages_view_from_temp(self):
        for dr in self.date_ranges_with_comparisons.values():  # pyright: ignore[reportAssignmentType]
            dr: DateRangeWithComparison = dr
            for date_range in [dr["date_range"], dr["comparison_date_range"]]:
                date_range_start_time = datetime.now()
                print(
                    f"Inserting pages view for {date_range['start']} to {date_range['end']}..."
                )

                filename = f"view_pages_{date_range['start'].date()}_{date_range['end'].date()}.parquet"

                self.views_utils.scan_temp(filename).sink_batches(
                    self.insert_batch, chunk_size=20_000, lazy=False
                )

                print(
                    f"  Finished in {format_timedelta(datetime.now() - date_range_start_time)}"
                )

    def get_view_date_range_data(
        self,
        date_range: DateRange,
    ) -> pl.LazyFrame:
        num_pages = self.context.pages.select(pl.len()).collect().item()

        doc_ids = [str(objectid()) for _ in range(num_pages)]

        id_series = pl.Series("_id", doc_ids)

        pages = self.context.pages.select(
            id_series,
            pl.lit(date_range).alias("dateRange"),
            pl.col("url"),
            pl.struct(
                pl.col("_id"),
                pl.col("title"),
                pl.col("url"),
                pl.col("lang"),
                pl.col("redirect"),
                pl.col("owners"),
                pl.col("sections"),
            ).alias("page"),
            pl.col("tasks"),
            pl.col("projects"),
            pl.col("pageStatus"),
            pl.lit(datetime.now()).alias("lastUpdated"),
        )

        top_level_metrics = self.get_top_level_page_metrics(date_range)
        num_comments = self.get_num_comments(date_range)
        aa_searchterms = self.get_aa_searchterms(date_range)
        gsc_searchterms = self.get_gsc_searchterms(date_range)
        activity_map = self.get_activity_map(date_range)
        return (
            pages.join(top_level_metrics, on="url", how="left")
            .join(num_comments, on="url", how="left")
            .join(aa_searchterms, on="url", how="left")
            .join(gsc_searchterms, on="url", how="left")
            .join(activity_map, on="url", how="left")
        )

    def get_top_level_page_metrics(self, date_range: DateRange) -> pl.LazyFrame:
        return (
            self.dependencies["page_metrics"]
            .lf()
            .filter(
                (pl.col("date") >= date_range["start"]),
                (pl.col("date") <= date_range["end"]),
            )
            .with_columns(pl.col("url").cast(self.context.page_urls_enum))
            .group_by("url")
            .agg(metrics_common_top_level_aggregations_expr)
        )

    def get_num_comments(self, date_range: DateRange) -> pl.LazyFrame:
        return (
            self.dependencies["feedback"]
            .lf()
            .select(["date", pl.col("url").cast(self.context.page_urls_enum)])
            .filter(
                pl.col("date") >= date_range["start"],
                pl.col("date") <= date_range["end"],
            )
            .group_by("url")
            .agg(pl.len().alias("numComments"))
            .with_columns(pl.col("numComments").fill_null(0).cast(pl.Int32))
        )

    def get_aa_searchterms(self, date_range: DateRange) -> pl.LazyFrame:
        return (
            self.dependencies["aa_searchterms"]
            .lf()
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .with_columns(
                pl.col("url").cast(self.context.page_urls_enum),
                pl.col("term").str.to_lowercase(),
            )
            .group_by(["url", "term"])
            .agg(
                pl.col("clicks").sum(),
                pl.col("position").mean().round_sig_figs(3),
            )
            .group_by("url")
            .agg(pl.struct(pl.all().top_k_by("clicks", 200)).alias("aa_searchterms"))
        )

    def get_gsc_searchterms(self, date_range: DateRange) -> pl.LazyFrame:
        return (
            self.dependencies["gsc_searchterms"]
            .lf()
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .with_columns(
                pl.col("url").cast(self.context.page_urls_enum),
                pl.col("term").str.to_lowercase(),
            )
            .group_by(["url", "term"])
            .agg(
                pl.col("clicks").sum(),
                pl.col("ctr").mean().round_sig_figs(3),
                pl.col("impressions").sum(),
                pl.col("position").mean().round_sig_figs(3),
            )
            .group_by("url")
            .agg(pl.struct(pl.all().top_k_by("clicks", 200)).alias("gsc_searchterms"))
        )

    def get_activity_map(self, date_range: DateRange) -> pl.LazyFrame:
        return (
            self.dependencies["activity_map"]
            .lf()
            .filter(pl.col("date").is_between(date_range["start"], date_range["end"]))
            .with_columns(
                pl.col("url").cast(self.context.page_urls_enum),
                pl.col("link").cast(self.context.activity_map_links_enum),
            )
            .group_by(["url", "link"])
            .agg(pl.col("clicks").sum())
            .group_by(["url"])
            .agg(pl.struct(pl.all().top_k_by("clicks", 100)).alias("activity_map"))
        )
