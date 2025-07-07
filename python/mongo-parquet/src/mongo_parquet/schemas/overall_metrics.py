import polars as pl
from pymongoarrow.api import Schema
from bson import ObjectId
from pyarrow import int64, timestamp, float64, int32
from . import MongoCollection, ParquetModel
from .overall_aa_searchterms_en import OverallAASearchTermsEn
from .overall_aa_searchterms_fr import OverallAASearchTermsFr
from .overall_gsc_searchterms import OverallGSCSearchTerms
from .utils import get_sample_date_range_filter
from ..sampling import SamplingContext
from copy import deepcopy


class OverallMetrics(ParquetModel):
    collection: str = "overall_metrics"
    parquet_filename: str = "overall_metrics.parquet"
    schema: Schema = Schema(
        {
            "_id": ObjectId,
            "date": timestamp("ms"),
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
            pl.col("average_time_spent").round(4).cast(pl.Float32),
            pl.col("bouncerate").round(4).cast(pl.Float32),
        ).sort("date")

    def reverse_transform(self, df: pl.DataFrame) -> pl.DataFrame:
        return df.with_columns(
            pl.col("_id").str.decode("hex"),
        )

    def get_sampling_filter(self, sampling_context: SamplingContext) -> dict:
        filter = deepcopy(self.filter or {})

        date_range_filter = get_sample_date_range_filter(sampling_context)

        filter.update(date_range_filter)

        return filter


class OverallMetricsModel(MongoCollection):
    collection = "overall_metrics"
    primary_model = OverallMetrics()
    secondary_models = [
        OverallAASearchTermsEn(),
        OverallAASearchTermsFr(),
        OverallGSCSearchTerms(),
    ]
