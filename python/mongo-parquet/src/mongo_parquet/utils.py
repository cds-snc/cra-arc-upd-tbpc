from datetime import datetime, timedelta
from functools import lru_cache
import os
import re
import shutil
from typing import Any, Literal, final
import polars as pl
import hashlib
from pymongoarrow.types import ObjectId


def last_day_of_month(any_day: datetime) -> datetime:
    # The day 28 exists in every month. 4 days later, it's always next month
    next_month = any_day.replace(day=28) + timedelta(days=4)
    # subtracting the number of the current day brings us back one month
    return next_month - timedelta(days=next_month.day)


def month_range(
    start: str | datetime, end: str | datetime, exact_start_date: bool = False
):
    if isinstance(start, str):
        start = datetime.strptime(start, "%Y-%m-%d")

    if isinstance(end, str):
        end = datetime.strptime(end, "%Y-%m-%d")

    if not exact_start_date:
        start = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    end = (
        last_day_of_month(end + timedelta(days=-1))
        if end.day == 1
        else last_day_of_month(end)
    )
    while start < end:
        next_month = last_day_of_month(start)
        yield (start, next_month)
        start = next_month + timedelta(days=1)


def year_range(
    start: str | datetime, end: str | datetime, exact_start_date: bool = False
):
    if isinstance(start, str):
        start = datetime.strptime(start, "%Y-%m-%d")
    if isinstance(end, str):
        end = datetime.strptime(end, "%Y-%m-%d")

    if not exact_start_date:
        start = start.replace(day=1, month=1, hour=0, minute=0, second=0, microsecond=0)

    end = end.replace(day=31, month=12)

    while start < end:
        next_year = start.replace(year=start.year + 1)
        yield (start, next_year)
        start = next_year


def format_timedelta(td: timedelta) -> str:
    if td.total_seconds() < 1:
        return str(td)
    ms_regex = re.compile(r"\.\d{6}$")

    return re.sub(ms_regex, "", str(td))


def ensure_dataframe(value: pl.Series | pl.DataFrame) -> pl.DataFrame:
    if isinstance(value, pl.DataFrame):
        return value
    raise ValueError("Value was expected to be a DataFrame")


def objectid(bin: bytes | None = None) -> ObjectId:
    """Convert bytes to ObjectId, caching the result."""
    if bin is None:
        return cached_objectid(ObjectId().binary)
    return cached_objectid(bin)

@lru_cache(maxsize=75_000)
def cached_objectid(bin: bytes) -> ObjectId:
    """Convert bytes to ObjectId, caching the result."""
    return ObjectId(bin)


def array_to_object(arr: list | dict) -> dict:
    if isinstance(arr, list):
        return {
            item["k"]: item["v"]
            for item in arr
            if isinstance(item, dict) and "k" in item and "v" in item
        }
    return arr


def convert_objectids(value: dict | list | bytes | Any):
    if isinstance(value, bytes):
        try:
            return objectid(value)
        except:  # noqa: E722
            return value
    elif isinstance(value, dict):
        return {k: convert_objectids(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [convert_objectids(item) for item in value]
    return value


def get_partition_values(
    df: pl.LazyFrame, partition_by: Literal["month", "year"]
) -> list[dict[str, int]]:
    partition_cols = ["year", "month"] if partition_by == "month" else ["year"]

    if not all(col in df.collect_schema().names() for col in partition_cols):
        raise ValueError(
            f"Partition columns {partition_cols} not found in the DataFrame."
        )

    return (
        df.select(partition_cols)
        .unique(partition_cols)
        .sort(partition_cols)
        .collect()
        .to_dicts()
    )


def hash_file(filepath: str) -> str:
    """
    Generate a MD5 hash for a file.

    :param filepath: Path to the file to hash.
    :return: MD5 hash of the file's contents.
    """
    with open(filepath, "rb") as f:
        return hashlib.file_digest(f, "md5").hexdigest()


# Currently unused
@final
class RefChangeTracker:
    """
    Tracks the changes in references before and after a sync, and calculates
    the differences, in order to easily update any affected Parquet files.
    """

    def __init__(self, data_dir: str, temp_dir: str):
        self.data_dir = data_dir
        self.temp_dir = temp_dir

    def save_before(self):
        # Back up the current state of the references
        for collection in ["pages", "tasks", "projects", "ux_tests"]:
            filepath = os.path.join(self.data_dir, f"{collection}.parquet")
            temp_path = os.path.join(f"{self.temp_dir}/before", f"{collection}.parquet")

            pl.scan_parquet(filepath).sink_parquet(temp_path, compression_level=5)

    def get_new_ids(
        self, before_df: pl.LazyFrame, after_df: pl.LazyFrame
    ) -> pl.DataFrame:
        new_ids = after_df.select(["_id"]).join(
            before_df.select(["_id"]), on="_id", how="anti"
        )
        return new_ids.collect()

    def get_removed_ids(
        self, before_df: pl.LazyFrame, after_df: pl.LazyFrame
    ) -> pl.DataFrame:
        removed_ids = before_df.select(["_id"]).join(
            after_df.select(["_id"]), on="_id", how="anti"
        )
        return removed_ids.collect()

    def get_changed(
        self, ref_fields: list[str], before_df: pl.LazyFrame, after_df: pl.LazyFrame
    ) -> pl.LazyFrame:
        schema = before_df.collect_schema()
        ref_col_expr = pl.col("_id")

        has_url = schema.get("url") is not None

        url_select = [pl.col("url")] if has_url else []

        for field_name in ref_fields:
            field = schema.get(field_name)
            if field is None:
                raise ValueError(f"Field '{field_name}' not found in DataFrame schema.")
            if field.is_nested():
                ref_col_expr = ref_col_expr.list.concat(pl.col(field_name).list.sort())
            else:
                ref_col_expr = ref_col_expr.list.concat(pl.col(field_name))

        fields_select = ["_id", *url_select, *ref_fields]

        before = (
            before_df.select(fields_select)
            .with_columns(ref_col_expr.list.join("-").alias("refs"))
            .select([*fields_select, "refs"])
        )

        after = (
            after_df.select(fields_select)
            .with_columns(ref_col_expr.list.join("-").alias("refs_new"))
            .select([*fields_select, "refs_new"])
        )

        return before.join(
            after,
            on=pl.col("_id"),
            how="left",
            nulls_equal=True,
            suffix="_new",
        ).filter(
            pl.col("refs_new").is_not_null(),  # don't include deleted refs
            pl.col("refs") != pl.col("refs_new"),
        )

    def get_distinct_url_page(self, df: pl.LazyFrame) -> pl.DataFrame:
        return df.unique(["url", "page"]).collect()


@final
class SyncUtils:
    """
    Utilities for syncing data between MongoDB and Parquet files, such as:

    - Hashing before and after, to skip uploading unchanged files.
    - Partition helpers for generating partitioned file paths for partial uploads.
    - Other helpers as needed.
    """

    file_hashes: dict[str, str] = {}
    new_data_hashes: dict[str, str] = {}

    upload_queue: list[str] = []

    partition_overlaps: dict[str, list[str]] = {}

    def __init__(self, parquet_dir_path: str, temp_dir_name: str = ".sync_temp"):
        temp_dir_str = os.path.join(parquet_dir_path, "..", temp_dir_name)
        self.parquet_dir_path: str = os.path.abspath(parquet_dir_path)
        self.temp_dir_path: str = os.path.abspath(temp_dir_str)
        self.backup_dir_path: str = os.path.join(self.temp_dir_path, "backup")
        self.incremental_dir_path: str = os.path.join(self.temp_dir_path, "incremental")

        self.ensure_temp_dirs()

    def file_has_changed(self, filepath: str) -> bool:
        """
        Check if a file has changed since the last hash check.

        :param filepath: Path to the file to check.
        :return: True if the file has changed, False otherwise.
        """
        previous_hash = self.file_hashes.get(filepath)

        if previous_hash is None:
            return True

        current_hash = hash_file(filepath)

        return previous_hash != current_hash

    def add_hash(self, filepath: str):
        """
        Add or update the hash of a file or partition folder.

        :param filepath: Path to the file or partition folder to hash.
        """
        if os.path.isdir(filepath):
            for root, _, files in os.walk(filepath):
                for file in files:
                    if file.endswith(".parquet"):
                        partition_filepath = os.path.join(root, file)

                        self.add_hash(partition_filepath)
            return

        if self.file_hashes.get(filepath) is not None:
            raise ValueError(f"Hash for {filepath} already exists.")

        self.file_hashes[filepath] = hash_file(filepath)

    def queue_file_upload(self, file_path: str):
        """
        Queue a file for upload.

        :param file_path: File path, relative to the root sync directory.
        """
        if file_path in self.upload_queue:
            raise ValueError(f"Upload path for {file_path} already exists.")

    def queue_upload_if_changed(self, file_path: str):
        """
        Add a file to the upload queue if it has changed.

        :param file_path: File path, relative to the root sync directory.
        """
        if self.file_has_changed(file_path):
            self.queue_file_upload(file_path)

    def ensure_temp_dirs(self):
        os.makedirs(self.temp_dir_path, exist_ok=True)
        os.makedirs(self.backup_dir_path, exist_ok=True)
        os.makedirs(self.incremental_dir_path, exist_ok=True)

    def cleanup_temp_dir(self):
        if os.path.exists(self.temp_dir_path):
            for root, dirs, files in os.walk(self.temp_dir_path, topdown=False):
                for name in files:
                    os.remove(os.path.join(root, name))
                for name in dirs:
                    os.rmdir(os.path.join(root, name))

    def backup_file(self, filename: str):
        filepath = os.path.join(self.parquet_dir_path, filename)

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File {filepath} does not exist for backup.")

        backup_path = os.path.join(self.backup_dir_path, filename)
        shutil.copy(filepath, backup_path)

    def restore_backup(self, filename: str):
        backup_path = os.path.join(self.backup_dir_path, filename)

        if not os.path.exists(backup_path):
            raise FileNotFoundError(f"Backup file {backup_path} does not exist.")

        filepath = os.path.join(self.parquet_dir_path, filename)
        shutil.copy(backup_path, filepath)


__all__ = [
    "last_day_of_month",
    "month_range",
    "year_range",
    "ensure_dataframe",
    "convert_objectids",
    "get_partition_values",
    "hash_file",
    "SyncUtils",
]
