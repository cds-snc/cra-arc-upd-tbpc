"""Tests for date range utilities."""

import pytest
from datetime import datetime, timedelta
from .daterange_utils import (
    get_date_ranges_with_comparisons,
    _today,
    date_range_labels,
    DateRangeType,
)


def test_today_returns_midnight():
    """Test that _today() returns a datetime with time set to 00:00:00.000."""
    today = _today()
    assert today.hour == 0
    assert today.minute == 0
    assert today.second == 0
    assert today.microsecond == 0


class TestDateRangeValidation:
    """Test that all date ranges are properly defined and have correct properties."""

    @pytest.fixture
    def date_ranges(self):
        """Get all date ranges for testing."""
        return get_date_ranges_with_comparisons()

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_date_range_exists(self, date_ranges, range_type):
        """Test that each date range type exists in the results."""
        assert range_type in date_ranges
        assert date_ranges[range_type] is not None

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_date_range_has_required_fields(self, date_ranges, range_type):
        """Test that each date range has label, date_range, and comparison_date_range."""
        range_data = date_ranges[range_type]
        assert "label" in range_data
        assert "date_range" in range_data
        assert "comparison_date_range" in range_data

        # Check date_range structure
        assert "start" in range_data["date_range"]
        assert "end" in range_data["date_range"]

        # Check comparison_date_range structure
        assert "start" in range_data["comparison_date_range"]
        assert "end" in range_data["comparison_date_range"]

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_date_range_times_are_midnight(self, date_ranges, range_type):
        """Test that all dates have time set to 00:00:00.000."""
        range_data = date_ranges[range_type]

        # Check main date range
        start = range_data["date_range"]["start"]
        end = range_data["date_range"]["end"]

        assert (
            start.hour == 0
            and start.minute == 0
            and start.second == 0
            and start.microsecond == 0
        )
        assert (
            end.hour == 0
            and end.minute == 0
            and end.second == 0
            and end.microsecond == 0
        )

        # Check comparison date range
        comp_start = range_data["comparison_date_range"]["start"]
        comp_end = range_data["comparison_date_range"]["end"]

        assert (
            comp_start.hour == 0
            and comp_start.minute == 0
            and comp_start.second == 0
            and comp_start.microsecond == 0
        )
        assert (
            comp_end.hour == 0
            and comp_end.minute == 0
            and comp_end.second == 0
            and comp_end.microsecond == 0
        )

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_end_date_before_today(self, date_ranges, range_type):
        """Test that end dates are before the current date."""
        range_data = date_ranges[range_type]
        end_date = range_data["date_range"]["end"]
        today = _today()

        assert end_date < today

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_start_date_before_end_date(self, date_ranges, range_type):
        """Test that start dates are before end dates."""
        range_data = date_ranges[range_type]
        start_date = range_data["date_range"]["start"]
        end_date = range_data["date_range"]["end"]

        assert start_date < end_date

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_labels_match_expected(self, date_ranges, range_type):
        """Test that labels match the expected values."""
        range_data = date_ranges[range_type]
        expected_label = date_range_labels[range_type]

        assert range_data["label"] == expected_label


class TestWeekdayAlignment:
    """Test that comparison dates maintain weekday alignment."""

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_comparison_date_weekday_alignment(self, range_type: DateRangeType):
        """Test that comparison dates are weekday-aligned with original dates."""
        date_ranges = get_date_ranges_with_comparisons()
        range_data = date_ranges[range_type]

        start_date = range_data["date_range"]["start"]
        comparison_start = range_data["comparison_date_range"]["start"]

        # weekday() returns 0=Monday, 1=Tuesday, ..., 6=Sunday
        start_weekday = start_date.weekday()
        comparison_weekday = comparison_start.weekday()

        assert (
            comparison_weekday == start_weekday
        ), f"Weekday mismatch for {range_type}: {start_weekday} vs {comparison_weekday}"


class TestComparisonPeriods:
    """Test that comparison periods have the same number of days as the original periods."""

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_same_number_of_days(self, range_type: DateRangeType):
        """Test that date ranges and comparison ranges have the same number of days."""
        date_ranges = get_date_ranges_with_comparisons()
        range_data = date_ranges[range_type]

        # Calculate days in original range
        start = range_data["date_range"]["start"]
        end = range_data["date_range"]["end"]
        original_days = (end - start).days

        # Calculate days in comparison range
        comp_start = range_data["comparison_date_range"]["start"]
        comp_end = range_data["comparison_date_range"]["end"]
        comparison_days = (comp_end - comp_start).days

        assert (
            comparison_days == original_days
        ), f"Day count mismatch for {range_type}: {original_days} vs {comparison_days}"

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_comparison_end_not_too_far_after_start(self, range_type):
        """Test that comparison end date is not 7+ days after the current start date."""
        date_ranges = get_date_ranges_with_comparisons()
        range_data = date_ranges[range_type]

        start = range_data["date_range"]["start"]
        comp_end = range_data["comparison_date_range"]["end"]

        seven_days_after_start = start + timedelta(days=7)

        assert (
            comp_end < seven_days_after_start
        ), f"Comparison end too far after start for {range_type}"


class TestFiscalYear:
    """Test fiscal year specific requirements."""

    def test_fiscal_year_starts_april_1(self):
        """Test that fiscal year starts on April 1st."""
        date_ranges = get_date_ranges_with_comparisons()
        fiscal_data = date_ranges["fiscal_year"]
        start_date = fiscal_data["date_range"]["start"]

        assert (
            start_date.month == 4
        ), f"Fiscal year should start in April, got month {start_date.month}"
        assert (
            start_date.day == 1
        ), f"Fiscal year should start on day 1, got day {start_date.day}"

    def test_fiscal_year_ends_march_31(self):
        """Test that fiscal year ends on March 31st."""
        date_ranges = get_date_ranges_with_comparisons()
        fiscal_data = date_ranges["fiscal_year"]
        end_date = fiscal_data["date_range"]["end"]

        assert (
            end_date.month == 3
        ), f"Fiscal year should end in March, got month {end_date.month}"
        assert (
            end_date.day == 31
        ), f"Fiscal year should end on day 31, got day {end_date.day}"

    def test_fiscal_year_comparison_weekday_aligned(self):
        """Test that fiscal year comparison dates are weekday-aligned."""
        date_ranges = get_date_ranges_with_comparisons()
        fiscal_data = date_ranges["fiscal_year"]

        start = fiscal_data["date_range"]["start"]
        comp_start = fiscal_data["comparison_date_range"]["start"]

        start_weekday = start.weekday()
        comp_weekday = comp_start.weekday()

        assert (
            comp_weekday == start_weekday
        ), f"Fiscal year weekday mismatch: {start_weekday} vs {comp_weekday}"


class TestParametricDateRanges:
    """Test date ranges with various input dates to ensure robustness."""

    @pytest.fixture
    def test_dates(self):
        """Generate various test dates similar to the TypeScript tests."""
        initial_date = _today()

        test_dates = [
            initial_date,
            initial_date + timedelta(days=1),
            initial_date + timedelta(days=3),
            initial_date + timedelta(weeks=1),
            initial_date + timedelta(weeks=2),
            initial_date + timedelta(weeks=3),
            initial_date + timedelta(weeks=4),
            initial_date + timedelta(days=30),  # ~1 month
            initial_date + timedelta(days=60),  # ~2 months
            initial_date + timedelta(days=63),  # ~2 months + 3 days
            initial_date + timedelta(days=90),  # ~3 months
            initial_date + timedelta(days=93),  # ~3 months + 3 days
            initial_date + timedelta(days=120),  # ~4 months
            initial_date + timedelta(days=141),  # ~4 months + 3 weeks
            initial_date + timedelta(days=90),  # ~1 quarter
            initial_date + timedelta(days=111),  # ~1 quarter + 3 weeks
            initial_date + timedelta(days=180),  # ~2 quarters
            initial_date + timedelta(days=210),  # ~7 months
            initial_date + timedelta(days=213),  # ~7 months + 3 days
            initial_date + timedelta(days=240),  # ~8 months
            initial_date + timedelta(days=243),  # ~8 months + 3 days
            initial_date + timedelta(days=270),  # ~3 quarters
            datetime(2024, 2, 29),  # leap year test
        ]

        return test_dates

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    def test_date_ranges_with_various_input_dates(
        self, test_dates, range_type: DateRangeType
    ):
        """Test that date ranges work correctly with various input dates."""
        for test_date in test_dates:
            date_ranges = get_date_ranges_with_comparisons(test_date)
            range_data = date_ranges[range_type]

            # Basic validation
            assert range_data is not None
            assert "date_range" in range_data
            assert "comparison_date_range" in range_data

            # Dates should be properly ordered
            start = range_data["date_range"]["start"]
            end = range_data["date_range"]["end"]
            comp_start = range_data["comparison_date_range"]["start"]
            comp_end = range_data["comparison_date_range"]["end"]

            assert (
                start < end
            ), f"Start should be before end for {range_type} with date {test_date}"
            assert (
                comp_start < comp_end
            ), f"Comparison start should be before comparison end for {range_type} with date {test_date}"

            # Same number of days
            original_days = (end - start).days
            comparison_days = (comp_end - comp_start).days
            assert (
                comparison_days == original_days
            ), f"Day count mismatch for {range_type} with date {test_date}"

            # Weekday alignment
            start_weekday = start.weekday()
            comp_start_weekday = comp_start.weekday()
            assert (
                comp_start_weekday == start_weekday
            ), f"Weekday mismatch for {range_type} with date {test_date}"


class TestSpecificDateRangeLogic:
    """Test specific logic for each date range type."""

    def test_week_range_sunday_to_saturday(self):
        """Test that week ranges go from Sunday to Saturday."""
        # Test with a known Thursday (October 2, 2025)
        test_date = datetime(2025, 10, 2)  # Thursday
        date_ranges = get_date_ranges_with_comparisons(test_date)
        week_data = date_ranges["week"]

        start = week_data["date_range"]["start"]
        end = week_data["date_range"]["end"]

        # In Python, weekday() returns 0=Monday, 6=Sunday
        # We want: start.weekday() == 6 (Sunday), end.weekday() == 5 (Saturday)
        assert (
            start.weekday() == 6
        ), f"Week should start on Sunday, got {start.strftime('%A')}"
        assert (
            end.weekday() == 5
        ), f"Week should end on Saturday, got {end.strftime('%A')}"

        # Should be exactly 7 days
        assert (
            end - start
        ).days == 6, "Week should span 6 days (Sunday to Saturday inclusive)"

    def test_last_52_weeks_alignment(self):
        """Test that last 52 weeks aligns to week boundaries."""
        test_date = datetime(2025, 10, 2)  # Thursday
        date_ranges = get_date_ranges_with_comparisons(test_date)
        weeks_data = date_ranges["last_52_weeks"]

        start = weeks_data["date_range"]["start"]
        end = weeks_data["date_range"]["end"]

        # Should start on Sunday and end on Saturday
        assert (
            start.weekday() == 6
        ), f"52 weeks should start on Sunday, got {start.strftime('%A')}"
        assert (
            end.weekday() == 5
        ), f"52 weeks should end on Saturday, got {end.strftime('%A')}"

        # Should be exactly 52 weeks (364 days)
        assert (end - start).days == 363, "52 weeks should span 363 days (52*7-1)"

    def test_year_to_date_starts_january_1(self):
        """Test that year to date starts on January 1st."""
        test_date = datetime(2025, 10, 2)
        date_ranges = get_date_ranges_with_comparisons(test_date)
        ytd_data = date_ranges["year_to_date"]

        start = ytd_data["date_range"]["start"]
        end = ytd_data["date_range"]["end"]

        assert start.month == 1, "Year to date should start in January"
        assert start.day == 1, "Year to date should start on day 1"
        assert end < test_date, "Year to date end should be before the test date"


class TestTypeScriptComparison:
    """Test Python implementation against TypeScript server output."""

    @pytest.fixture
    def test_dates(self):
        """Generate test dates for comparison with TypeScript."""
        initial_date = _today()

        test_dates = [
            initial_date,
            initial_date + timedelta(days=1),
            initial_date + timedelta(days=3),
            initial_date + timedelta(weeks=1),
            initial_date + timedelta(weeks=2),
            initial_date + timedelta(weeks=3),
            initial_date + timedelta(weeks=4),
            initial_date + timedelta(days=30),  # ~1 month
            initial_date + timedelta(days=60),  # ~2 months
            initial_date + timedelta(days=90),  # ~3 months
            initial_date + timedelta(days=120),  # ~4 months
            initial_date + timedelta(days=180),  # ~6 months
            initial_date + timedelta(days=270),  # ~9 months
            datetime(2024, 2, 29),  # leap year test
            datetime(2025, 1, 1),  # new year
            datetime(2025, 3, 31),  # fiscal year end
            datetime(2025, 4, 1),  # fiscal year start
            datetime(2025, 12, 31),  # year end
        ]

        return test_dates

    async def _fetch_typescript_data(self, date: datetime):
        """Fetch date ranges from TypeScript server."""
        import httpx

        date_str = date.strftime("%Y-%m-%d")
        url = f"http://localhost:3123/date-ranges?date={date_str}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=5.0)
                response.raise_for_status()
                return response.json()
        except httpx.RequestError as e:
            pytest.skip(f"TypeScript server not available: {e}")
        except httpx.HTTPStatusError as e:
            pytest.skip(f"TypeScript server returned error: {e}")

    def _convert_typescript_dates(self, ts_data):
        """Convert TypeScript ISO date strings to datetime objects."""
        converted = {}

        for range_type, range_data in ts_data.items():
            converted[range_type] = {
                "label": range_data["label"],
                "date_range": {
                    "start": datetime.fromisoformat(
                        range_data["date_range"]["start"].replace("Z", "+00:00")
                    ).replace(tzinfo=None),
                    "end": datetime.fromisoformat(
                        range_data["date_range"]["end"].replace("Z", "+00:00")
                    ).replace(tzinfo=None),
                },
                "comparison_date_range": {
                    "start": datetime.fromisoformat(
                        range_data["comparison_date_range"]["start"].replace(
                            "Z", "+00:00"
                        )
                    ).replace(tzinfo=None),
                    "end": datetime.fromisoformat(
                        range_data["comparison_date_range"]["end"].replace(
                            "Z", "+00:00"
                        )
                    ).replace(tzinfo=None),
                },
            }

        return converted

    @pytest.mark.parametrize(
        "range_type",
        [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ],
    )
    @pytest.mark.asyncio
    async def test_python_vs_typescript_date_ranges(self, test_dates, range_type):
        """Test that Python and TypeScript implementations produce identical date ranges."""
        for test_date in test_dates:
            # Get Python result
            python_result = get_date_ranges_with_comparisons(test_date)
            python_data = python_result[range_type]

            # Get TypeScript result
            ts_raw_data = await self._fetch_typescript_data(test_date)
            ts_data = self._convert_typescript_dates(ts_raw_data)[range_type]

            # Compare labels
            assert (
                python_data["label"] == ts_data["label"]
            ), f"Label mismatch for {range_type} with date {test_date}: Python='{python_data['label']}', TS='{ts_data['label']}'"

            # Compare main date range
            py_start = python_data["date_range"]["start"]
            py_end = python_data["date_range"]["end"]
            ts_start = ts_data["date_range"]["start"]
            ts_end = ts_data["date_range"]["end"]

            assert (
                py_start == ts_start
            ), f"Start date mismatch for {range_type} with date {test_date}: Python={py_start}, TS={ts_start}"
            assert (
                py_end == ts_end
            ), f"End date mismatch for {range_type} with date {test_date}: Python={py_end}, TS={ts_end}"

            # Compare comparison date range
            py_comp_start = python_data["comparison_date_range"]["start"]
            py_comp_end = python_data["comparison_date_range"]["end"]
            ts_comp_start = ts_data["comparison_date_range"]["start"]
            ts_comp_end = ts_data["comparison_date_range"]["end"]

            assert (
                py_comp_start == ts_comp_start
            ), f"Comparison start date mismatch for {range_type} with date {test_date}: Python={py_comp_start}, TS={ts_comp_start}"
            assert (
                py_comp_end == ts_comp_end
            ), f"Comparison end date mismatch for {range_type} with date {test_date}: Python={py_comp_end}, TS={ts_comp_end}"

    @pytest.mark.asyncio
    async def test_full_response_structure_matches(self, test_dates):
        """Test that the overall response structure matches between Python and TypeScript."""
        for test_date in test_dates[
            :3
        ]:  # Test with first 3 dates to avoid too many requests
            # Get Python result
            python_result = get_date_ranges_with_comparisons(test_date)

            # Get TypeScript result
            ts_raw_data = await self._fetch_typescript_data(test_date)
            ts_converted = self._convert_typescript_dates(ts_raw_data)

            # Check that all expected range types are present
            expected_types = {
                "week",
                "month",
                "quarter",
                "year",
                "fiscal_year",
                "last_52_weeks",
                "year_to_date",
            }

            assert (
                set(python_result.keys()) == expected_types
            ), f"Python result missing range types for date {test_date}"
            assert (
                set(ts_converted.keys()) == expected_types
            ), f"TypeScript result missing range types for date {test_date}"

            # Check structure of each range type
            for range_type in expected_types:
                py_range = python_result[range_type]
                ts_range = ts_converted[range_type]

                # Both should have the same structure
                assert set(py_range.keys()) == {
                    "label",
                    "date_range",
                    "comparison_date_range",
                }, f"Python {range_type} structure incorrect for date {test_date}"
                assert set(ts_range.keys()) == {
                    "label",
                    "date_range",
                    "comparison_date_range",
                }, f"TypeScript {range_type} structure incorrect for date {test_date}"

                # Date ranges should have start and end
                assert (
                    set(py_range["date_range"].keys()) == {"start", "end"}
                ), f"Python {range_type} date_range structure incorrect for date {test_date}"
                assert (
                    set(ts_range["date_range"].keys()) == {"start", "end"}
                ), f"TypeScript {range_type} date_range structure incorrect for date {test_date}"

                assert (
                    set(py_range["comparison_date_range"].keys()) == {"start", "end"}
                ), f"Python {range_type} comparison_date_range structure incorrect for date {test_date}"
                assert (
                    set(ts_range["comparison_date_range"].keys()) == {"start", "end"}
                ), f"TypeScript {range_type} comparison_date_range structure incorrect for date {test_date}"

    @pytest.mark.parametrize(
        "test_date",
        [
            datetime(2025, 10, 2),  # Thursday
            datetime(2025, 1, 1),  # New Year's Day (Wednesday)
            datetime(2024, 2, 29),  # Leap year day (Thursday)
            datetime(2025, 3, 31),  # Fiscal year end (Monday)
            datetime(2025, 4, 1),  # Fiscal year start (Tuesday)
        ],
    )
    @pytest.mark.asyncio
    async def test_specific_edge_cases_match_typescript(self, test_date):
        """Test specific edge cases match exactly between implementations."""
        # Get Python result
        python_result = get_date_ranges_with_comparisons(test_date)

        # Get TypeScript result
        ts_raw_data = await self._fetch_typescript_data(test_date)
        ts_converted = self._convert_typescript_dates(ts_raw_data)

        for range_type in [
            "week",
            "month",
            "quarter",
            "year",
            "fiscal_year",
            "last_52_weeks",
            "year_to_date",
        ]:
            py_data = python_result[range_type]
            ts_data = ts_converted[range_type]

            # Check that date ranges are identical
            assert (
                py_data["date_range"]["start"] == ts_data["date_range"]["start"]
            ), f"Edge case start mismatch for {range_type} on {test_date}"
            assert (
                py_data["date_range"]["end"] == ts_data["date_range"]["end"]
            ), f"Edge case end mismatch for {range_type} on {test_date}"

            # Check comparison ranges
            assert (
                py_data["comparison_date_range"]["start"]
                == ts_data["comparison_date_range"]["start"]
            ), f"Edge case comparison start mismatch for {range_type} on {test_date}"
            assert (
                py_data["comparison_date_range"]["end"]
                == ts_data["comparison_date_range"]["end"]
            ), f"Edge case comparison end mismatch for {range_type} on {test_date}"
