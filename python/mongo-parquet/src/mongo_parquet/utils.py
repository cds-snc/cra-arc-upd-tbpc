from datetime import datetime, timedelta
from functools import lru_cache
import polars as pl
from pymongoarrow.types import ObjectId


def last_day_of_month(any_day: datetime) -> datetime:
    # The day 28 exists in every month. 4 days later, it's always next month
    next_month = any_day.replace(day=28) + timedelta(days=4)
    # subtracting the number of the current day brings us back one month
    return next_month - timedelta(days=next_month.day)


def month_range(start: str | datetime, end: str | datetime):
    if isinstance(start, str):
        start = datetime.strptime(start, "%Y-%m-%d")

    if isinstance(end, str):
        end = datetime.strptime(end, "%Y-%m-%d")

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


def year_range(start: str | datetime, end: str | datetime):
    if isinstance(start, str):
        start = datetime.strptime(start, "%Y-%m-%d")
    if isinstance(end, str):
        end = datetime.strptime(end, "%Y-%m-%d")

    start = start.replace(day=1, month=1, hour=0, minute=0, second=0, microsecond=0)
    end = end.replace(day=31, month=12)

    while start < end:
        next_year = start.replace(year=start.year + 1)
        yield (start, next_year)
        start = next_year


def ensure_dataframe(value: pl.Series | pl.DataFrame) -> pl.DataFrame:
    if isinstance(value, pl.DataFrame):
        return value
    raise ValueError("Value was expected to be a DataFrame")


@lru_cache(maxsize=75_000)
def objectid(bin: bytes) -> ObjectId:
    """Convert bytes to ObjectId, caching the result."""
    return ObjectId(bin)


def array_to_object(arr):
    if isinstance(arr, list):
        return {
            item["k"]: item["v"]
            for item in arr
            if isinstance(item, dict) and "k" in item and "v" in item
        }
    return arr


def convert_objectids(value):
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


def parse_objectids(row, objectid_fields: list[str]):
    for key in objectid_fields:
        if key in row:
            row[key] = convert_objectids(row[key])
    return row


__all__ = [
    "last_day_of_month",
    "month_range",
    "year_range",
    "ensure_dataframe",
    "convert_objectids",
    "parse_objectids",
]
