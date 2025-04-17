import datetime
import polars as pl

def last_day_of_month(any_day: datetime.datetime) -> datetime.datetime:
    # The day 28 exists in every month. 4 days later, it's always next month
    next_month = any_day.replace(day=28) + datetime.timedelta(days=4)
    # subtracting the number of the current day brings us back one month
    return next_month - datetime.timedelta(days=next_month.day)


def month_range(start_str: str, end_str: str):
    start = datetime.datetime.strptime(start_str, "%Y-%m-%d")
    end = datetime.datetime.strptime(end_str, "%Y-%m-%d")

    start = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (
        last_day_of_month(end + datetime.timedelta(days=-1))
        if end.day == 1
        else last_day_of_month(end)
    )
    while start < end:
        next_month = last_day_of_month(start)
        yield (start, next_month)
        start = next_month + datetime.timedelta(days=1)

def year_range(start_str: str, end_str: str):
    start = datetime.datetime.strptime(start_str, "%Y-%m-%d")
    end = datetime.datetime.strptime(end_str, "%Y-%m-%d")

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