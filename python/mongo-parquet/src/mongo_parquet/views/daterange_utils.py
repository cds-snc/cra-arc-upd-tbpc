"""Date range utilities to calculate preset date ranges and their comparisons."""

from datetime import datetime, timedelta
from typing import Literal, TypedDict


class DateRange(TypedDict):
    start: datetime
    end: datetime


class DateRangeWithComparison(TypedDict):
    label: str
    date_range: DateRange
    comparison_date_range: DateRange


type DateRangeType = Literal[
    "week", "month", "quarter", "year", "fiscal_year", "last_52_weeks", "year_to_date"
]


class DateRangesWithComparisons(TypedDict):
    week: DateRangeWithComparison
    month: DateRangeWithComparison
    quarter: DateRangeWithComparison
    year: DateRangeWithComparison
    fiscal_year: DateRangeWithComparison
    last_52_weeks: DateRangeWithComparison
    year_to_date: DateRangeWithComparison


date_range_labels: dict[DateRangeType, str] = {
    "week": "Last week",
    "month": "Last month",
    "quarter": "Last quarter",
    "year": "Last year",
    "fiscal_year": "Last fiscal year",
    "last_52_weeks": "Last 52 weeks",
    "year_to_date": "Year to date",
}


def _normalize_date(date: datetime) -> datetime:
    """Normalize a datetime to midnight."""
    return date.replace(hour=0, minute=0, second=0, microsecond=0)


def _today() -> datetime:
    """Get the current date as datetime object."""
    return _normalize_date(datetime.now())


def _start_of_week(date: datetime) -> datetime:
    """Get the start of the week (Sunday) for a given date."""
    date = _normalize_date(date)
    days_since_sunday = (date.weekday() + 1) % 7
    return date - timedelta(days=days_since_sunday)


def _start_of_month(date: datetime) -> datetime:
    """Get the first day of the month for a given date."""
    date = _normalize_date(date)
    return date.replace(day=1)


def _start_of_quarter(date: datetime) -> datetime:
    """Get the first day of the quarter for a given date."""
    date = _normalize_date(date)
    quarter_month = ((date.month - 1) // 3) * 3 + 1
    return date.replace(month=quarter_month, day=1)


def _start_of_year(date: datetime) -> datetime:
    """Get the first day of the year for a given date."""
    date = _normalize_date(date)
    return date.replace(month=1, day=1)


def _end_of_month(date: datetime) -> datetime:
    """Get the last day of the month for a given date."""
    date = _normalize_date(date)
    if date.month == 12:
        next_month = date.replace(year=date.year + 1, month=1, day=1)
    else:
        next_month = date.replace(month=date.month + 1, day=1)
    return next_month - timedelta(days=1)


def _end_of_quarter(date: datetime) -> datetime:
    """Get the last day of the quarter for a given date."""
    date = _normalize_date(date)
    quarter_month = ((date.month - 1) // 3 + 1) * 3
    if quarter_month > 12:
        quarter_month = 12
    end_of_quarter_month = date.replace(month=quarter_month)
    return _end_of_month(end_of_quarter_month)


def _subtract_weeks(weeks: int, from_date: datetime) -> datetime:
    """Helper to subtract a number of weeks from a date while keeping midnight."""
    return _normalize_date(from_date) - timedelta(weeks=weeks)


def _subtract_year(date: datetime) -> datetime:  # pyright: ignore[reportUnusedFunction]
    """Subtract one calendar year, mirroring Day.js year subtraction semantics."""
    date = _normalize_date(date)
    try:
        return date.replace(year=date.year - 1)
    except ValueError:
        # Handle leap day by falling back to February 28
        return date.replace(month=2, day=28, year=date.year - 1)


def _get_generic_comparison_date(
    period_type: Literal["week", "month", "year"], from_date: datetime
) -> datetime:
    """Replicate TypeScript generic comparison logic based on weeks per period."""

    weeks_per_period: dict[Literal["week", "month", "year"], int] = {
        "week": 1,
        "month": 4,
        "year": 52,
    }
    return _subtract_weeks(weeks_per_period[period_type], from_date)


def _get_quarter_comparison_date(from_date: datetime) -> datetime:
    """Match TypeScript quarter comparison logic with weekday alignment safeguards."""
    from_date = _normalize_date(from_date)
    current_range_start = _get_period_date_range("quarter", from_date)["start"]

    seven_days_after_start = current_range_start + timedelta(days=7)
    seven_days_before_start = current_range_start - timedelta(days=7)

    # Math.floor(dayjs.duration(3, 'months').asWeeks()) === 13
    comparison_date = _subtract_weeks(13, from_date)

    is_start = seven_days_before_start <= comparison_date <= seven_days_after_start

    if comparison_date >= seven_days_after_start or (
        is_start and (comparison_date - _end_of_quarter(comparison_date)).days < 90
    ):
        comparison_date = _subtract_weeks(1, comparison_date)

    return comparison_date


def _get_period_date_range(
    period_type: str, from_date: datetime | None = None
) -> DateRange:
    """Get date range for a generic period (week, month, quarter, year)."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    if period_type == "week":
        end = _start_of_week(from_date) - timedelta(days=1)
        start = _start_of_week(end)
    elif period_type == "month":
        end = _start_of_month(from_date) - timedelta(days=1)
        start = _start_of_month(end)
    elif period_type == "quarter":
        end = _start_of_quarter(from_date) - timedelta(days=1)
        start = _start_of_quarter(end)
    elif period_type == "year":
        end = _start_of_year(from_date) - timedelta(days=1)
        start = _start_of_year(end)
    else:
        raise ValueError(f"Unsupported period type: {period_type}")

    return {"start": start, "end": end}


def _get_comparison_date_range(
    period_type: DateRangeType, date_range: DateRange
) -> DateRange:
    """Get comparison date range for a given date range."""

    if period_type == "quarter":
        return {
            "start": _get_quarter_comparison_date(date_range["start"]),
            "end": _get_quarter_comparison_date(date_range["end"]),
        }

    if period_type in ["fiscal_year", "last_52_weeks", "year_to_date"]:
        period_type = "year"

    period: Literal["week", "month", "year"] = (
        "week"
        if period_type == "week"
        else "month"
        if period_type == "month"
        else "year"
    )

    return {
        "start": _get_generic_comparison_date(period, date_range["start"]),
        "end": _get_generic_comparison_date(period, date_range["end"]),
    }


def _get_week_range(from_date: datetime | None = None) -> DateRangeWithComparison:
    """Get last week date range with comparison."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    date_range = _get_period_date_range("week", from_date)
    comparison_date_range = _get_comparison_date_range("week", date_range)

    return {
        "label": date_range_labels["week"],
        "date_range": date_range,
        "comparison_date_range": comparison_date_range,
    }


def _get_month_range(from_date: datetime | None = None) -> DateRangeWithComparison:
    """Get last month date range with comparison."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    date_range = _get_period_date_range("month", from_date)
    comparison_date_range = _get_comparison_date_range("month", date_range)

    return {
        "label": date_range_labels["month"],
        "date_range": date_range,
        "comparison_date_range": comparison_date_range,
    }


def _get_quarter_range(from_date: datetime | None = None) -> DateRangeWithComparison:
    """Get last quarter date range with comparison."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    date_range = _get_period_date_range("quarter", from_date)
    comparison_date_range = _get_comparison_date_range("quarter", date_range)

    return {
        "label": date_range_labels["quarter"],
        "date_range": date_range,
        "comparison_date_range": comparison_date_range,
    }


def _get_year_range(from_date: datetime | None = None) -> DateRangeWithComparison:
    """Get last year date range with comparison."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    date_range = _get_period_date_range("year", from_date)
    comparison_date_range = _get_comparison_date_range("year", date_range)

    return {
        "label": date_range_labels["year"],
        "date_range": date_range,
        "comparison_date_range": comparison_date_range,
    }


def _get_fiscal_year_date_range(from_date: datetime) -> DateRange:
    """Get fiscal year date range for a given date."""
    from_date = _normalize_date(from_date)
    # Fiscal year ends March 31
    current_year_end = datetime(from_date.year, 3, 31)

    # If we're before March 31, use previous year's fiscal year
    if current_year_end > from_date:
        current_year_end = datetime(from_date.year - 1, 3, 31)

    end = current_year_end
    start = datetime(end.year - 1, 4, 1)  # April 1 of previous year

    return {"start": start, "end": end}


def _get_fiscal_year_range(
    from_date: datetime | None = None,
) -> DateRangeWithComparison:
    """Get last fiscal year date range with comparison (April 1 - March 31)."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    date_range = _get_fiscal_year_date_range(from_date)
    comparison_date_range = _get_comparison_date_range("fiscal_year", date_range)

    return {
        "label": date_range_labels["fiscal_year"],
        "date_range": date_range,
        "comparison_date_range": comparison_date_range,
    }


def _get_last_52_weeks_date_range(from_date: datetime) -> DateRange:
    """Get last 52 weeks date range for a given date."""
    from_date = _normalize_date(from_date)
    end = _start_of_week(from_date) - timedelta(days=1)
    start = _start_of_week(end)  # 1 week
    start = start - timedelta(weeks=51)  # + 51 weeks = 52 weeks total

    return {"start": start, "end": end}


def _get_last_52_weeks_range(
    from_date: datetime | None = None,
) -> DateRangeWithComparison:
    """Get last 52 weeks date range with comparison."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    date_range = _get_last_52_weeks_date_range(from_date)
    comparison_date_range = _get_comparison_date_range("last_52_weeks", date_range)

    return {
        "label": date_range_labels["last_52_weeks"],
        "date_range": date_range,
        "comparison_date_range": comparison_date_range,
    }


def _get_year_to_date_date_range(from_date: datetime) -> DateRange:
    """Get year to date range for a given date."""
    from_date = _normalize_date(from_date)
    end = from_date - timedelta(days=1)
    start = _start_of_year(end)

    return {"start": start, "end": end}


def _get_year_to_date_range(
    from_date: datetime | None = None,
) -> DateRangeWithComparison:
    """Get year to date range with comparison."""
    if from_date is None:
        from_date = _today()
    else:
        from_date = _normalize_date(from_date)

    date_range = _get_year_to_date_date_range(from_date)
    comparison_date_range = _get_comparison_date_range("year_to_date", date_range)

    return {
        "label": date_range_labels["year_to_date"],
        "date_range": date_range,
        "comparison_date_range": comparison_date_range,
    }


def get_date_ranges_with_comparisons(
    from_date: datetime | None = None,
) -> DateRangesWithComparisons:
    """
    Get all predefined date ranges with their comparison periods.

    Args:
        from_date: Reference date for calculations. Defaults to today.

    Returns:
        Dictionary containing all date range types with their ranges and comparisons.
    """
    return {
        "week": _get_week_range(from_date),
        "month": _get_month_range(from_date),
        "quarter": _get_quarter_range(from_date),
        "year": _get_year_range(from_date),
        "fiscal_year": _get_fiscal_year_range(from_date),
        "last_52_weeks": _get_last_52_weeks_range(from_date),
        "year_to_date": _get_year_to_date_range(from_date),
    }


def get_date_ranges_min_max(date_ranges: DateRangesWithComparisons) -> DateRange:
    """Get the overall min and max dates from a set of date ranges with comparisons."""
    min_date = min(
        dr["date_range"]["start"]  # type: ignore  # pyright: ignore[reportIndexIssue]
        for dr in date_ranges.values()
    )
    max_date = max(
        dr["date_range"]["end"]  # type: ignore  # pyright: ignore[reportIndexIssue]
        for dr in date_ranges.values()
    )
    return {"start": min_date, "end": max_date}
