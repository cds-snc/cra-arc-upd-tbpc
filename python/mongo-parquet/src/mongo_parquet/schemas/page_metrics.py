import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import int64, string, timestamp, list_, float64, int32
from pymongoarrow.types import ObjectIdType
from . import MongoCollection, ParquetModel
from .aa_searchterms import AASearchTerms
from .activity_map import ActivityMap
from .gsc_searchterms import GSCSearchTerms
from .utils import get_sample_ids, get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


class PageMetrics(ParquetModel):
    collection: str = "pages_metrics"
    parquet_filename: str = "pages_metrics.parquet"
    partition_by = "month"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
            "url": string(),
            "page": ObjectId,
            "tasks": list_(ObjectIdType()),
            "projects": list_(ObjectIdType()),
            "ux_tests": list_(ObjectIdType()),
            "average_time_spent": float64(),
            "bouncerate": float64(),
            "dyf_no": int32(),
            "dyf_submit": int32(),
            "dyf_yes": int32(),
            "fwylf_cant_find_info": int32(),
            "fwylf_error": int32(),
            "fwylf_hard_to_understand": int32(),
            "fwylf_other": int32(),
            "gsc_total_clicks": int64(),
            "gsc_total_ctr": float64(),
            "gsc_total_impressions": int64(),
            "gsc_total_position": float64(),
            "nav_menu_initiated": int32(),
            "rap_404": int32(),
            "rap_access_code": int32(),
            "rap_blank_form": int32(),
            "rap_cant_find": int32(),
            "rap_completed": int32(),
            "rap_gc_key": int32(),
            "rap_info_missing": int32(),
            "rap_info_wrong": int32(),
            "rap_initiated": int32(),
            "rap_link_not_working": int32(),
            "rap_login_error": int32(),
            "rap_other": int32(),
            "rap_other_login": int32(),
            "rap_securekey": int32(),
            "rap_sin": int32(),
            "rap_spelling": int32(),
            "views": int32(),
            "visitors": int32(),
            "visits": int32(),
            "visits_device_desktop": int32(),
            "visits_device_mobile": int32(),
            "visits_device_other": int32(),
            "visits_device_tablet": int32(),
            "visits_geo_ab": int32(),
            "visits_geo_bc": int32(),
            "visits_geo_mb": int32(),
            "visits_geo_nb": int32(),
            "visits_geo_nl": int32(),
            "visits_geo_ns": int32(),
            "visits_geo_nt": int32(),
            "visits_geo_nu": int32(),
            "visits_geo_on": int32(),
            "visits_geo_outside_canada": int32(),
            "visits_geo_pe": int32(),
            "visits_geo_qc": int32(),
            "visits_geo_sk": int32(),
            "visits_geo_us": int32(),
            "visits_geo_yt": int32(),
            "visits_referrer_other": int32(),
            "visits_referrer_searchengine": int32(),
            "visits_referrer_social": int32(),
            "visits_referrer_typed_bookmarked": int32(),
        }
    )

    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").bin.encode("hex"),
            pl.col("page").bin.encode("hex"),
            pl.col("tasks").list.eval(pl.element().bin.encode("hex")),
            pl.col("projects").list.eval(pl.element().bin.encode("hex")),
            pl.col("ux_tests").list.eval(pl.element().bin.encode("hex")),
            pl.col("average_time_spent").round(4).cast(pl.Float32),
            pl.col("bouncerate").round(4).cast(pl.Float32),
            pl.col("gsc_total_ctr").round(4).cast(pl.Float32),
            pl.col("gsc_total_position").round(4).cast(pl.Float32),
        ).sort("date", "url")

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
            pl.col("page").str.decode("hex"),
            pl.col("tasks").list.eval(pl.element().str.decode("hex")),
            pl.col("projects").list.eval(pl.element().str.decode("hex")),
            pl.col("ux_tests").list.eval(pl.element().str.decode("hex")),
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        task_ids = get_sample_ids(sampling_context, "task")
        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update({"tasks": {"$in": task_ids}})
        filter.update(date_range_filter)

        return filter


class PagesMetricsModel(MongoCollection):
    collection = "pages_metrics"
    primary_model = PageMetrics()
    secondary_models = [
        AASearchTerms(),
        ActivityMap(),
        GSCSearchTerms(),
    ]
