import _dayjs, {
  Dayjs as _Dayjs,
  OpUnitType as _OpUnitType,
  QUnitType as _QUnitType,
} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import duration, { DurationUnitType } from 'dayjs/plugin/duration';
import isBetween from 'dayjs/plugin/isBetween';
import 'dayjs/locale/en-ca';
import 'dayjs/locale/fr-ca';
import { partial, zip } from 'rambdax';
import type { AbstractDate, DateRange } from '@dua-upd/types-common';

_dayjs.extend(utc);
_dayjs.extend(quarterOfYear);
_dayjs.extend(duration);
_dayjs.extend(isBetween);

// Re-export dayjs object and types to be able to import from here
export const dayjs = _dayjs;
export type Dayjs = _Dayjs;
export type OpUnitType = _OpUnitType;
export type QUnitType = _QUnitType;

export function datesFromDateRange(
  dateRange: DateRange<Dayjs> | DateRange<Date> | string,
  format: string | false = 'YYYY-MM-DD',
  inclusive = false,
): Date[] | string[] {
  dateRange =
    typeof dateRange === 'string' ? parseDateRangeString(dateRange) : dateRange;
  const dates: Dayjs[] = [];

  let currentDate = dayjs.utc(dateRange.start);

  const endDate = inclusive
    ? dayjs.utc(dateRange.end).add(1, 'day')
    : dayjs.utc(dateRange.end);

  if (endDate.isBefore(currentDate)) {
    throw Error('Invalid dateRange - end is before start');
  }

  while (!currentDate.isSame(endDate, 'day')) {
    dates.push(currentDate);
    currentDate = currentDate.add(1, 'day');
  }

  return format
    ? dates.map((date) => date.format(format))
    : dates.map((date) => date.toDate());
}

/**
 * Creates an array of date ranges for each month in the given date range.
 * If `inclusive` is true, the end date is included in the range.
 *
 * For example, if `inclusive` is `true` and the date range is `'2021-01-01/2021-03-01'`, the function will return:
 *
 * `['2021-01-01/2021-01-31', '2021-02-01/2021-02-28', '2021-03-01/2021-03-31']`
 *
 * @param parsedDateRange The date range to get months from
 * @param format The format to return the date ranges in
 * @param inclusive Whether to include the end date in the range
 * @returns An array of date ranges in the specified format
 */
export function monthsFromDateRange(
  dateRange: DateRange<Dayjs> | DateRange<Date> | string,
  inclusive = false,
  exactEndDate = false,
): DateRange<Date>[] {
  const parsedDateRange =
    typeof dateRange === 'string' ? parseDateRangeString(dateRange) : dateRange;

  const dates: DateRange<Date>[] = [];

  let currentDate = dayjs.utc(parsedDateRange.start).startOf('month');

  const exactEnd = inclusive
    ? dayjs.utc(parsedDateRange.end)
    : dayjs.utc(parsedDateRange.end).subtract(1, 'day');

  const endDate = exactEnd.endOf('month');

  if (endDate.isBefore(currentDate)) {
    throw Error('Invalid dateRange - end is before start');
  }

  while (!currentDate.isAfter(endDate, 'month')) {
    const endOfMonth = currentDate.endOf('month');
    const end = (
      exactEndDate && endOfMonth.isAfter(exactEnd) ? exactEnd : endOfMonth
    ).toDate();

    dates.push({ start: currentDate.toDate(), end });
    currentDate = currentDate.add(1, 'month');
  }

  return dates;
}

/**
 * Split a daterange string into an array containing startDate and endDate
 * @param dateRange 'YYYY-MM-DD/YYYY-MM-DD'
 * @return [startDate: Date, endDate: Date]
 *
 */
export const dateRangeSplit = (dateRange: string): Date[] =>
  dateRange.split('/').map((d) => new Date(d));

export const parseDateRangeString = (dateRange: string): DateRange<Date> => {
  const [start, end] = dateRangeSplit(dateRange);

  return { start, end };
};

/**
 * Utility for correcting UTC dates if they're off by 1 (for calculating what "today" is)
 *  (i.e. when "today" in UTC is actually "tomorrow" in the local timezone)
 * @param date
 */
export const normalizeUTCDate = (date: Date | string | Dayjs) => {
  const localDate = dayjs.utc(date).local().date();
  const utcDate = dayjs.utc(date).date();
  const datesAreDifferent = localDate !== utcDate;

  const datejs = dayjs(date);

  return datejs.isUTC() && datesAreDifferent
    ? datejs.subtract(1, 'day').startOf('day')
    : datejs;
};

export const startOfDay = (date: string | Date | Dayjs) =>
  dayjs(date).startOf('day');

export const today = () => startOfDay(normalizeUTCDate(dayjs.utc()));

/*
 * For calculating different types of dynamic date ranges,
 * based on current date:
 */

export const dateRangeTypes = [
  'week',
  'month',
  'quarter',
  'year',
  'fiscal_year',
  'last_52_weeks',
  'year_to_date',
] as const;

export type DateRangeType = (typeof dateRangeTypes)[number] | 'custom';

export interface DateRangeConfig {
  type: DateRangeType;
  label: string;
  getDateRange: (fromDate?: AbstractDate) => DateRange<Dayjs>;
  getComparisonDate: (fromDate?: AbstractDate) => Dayjs;
}

// For "generic" date range types, i.e. last week/month/quarter/year, + previous
export const getPeriodDateRange = (
  periodName: OpUnitType | QUnitType,
  fromDate: AbstractDate = today(),
) => {
  const end = dayjs.utc(fromDate).startOf(periodName).subtract(1, 'day');

  return {
    start: end.subtract(1, 'day').startOf(periodName),
    end,
  } as DateRange<Dayjs>;
};

export const getComparisonDate = (
  [periodName]: OpUnitType | QUnitType,
  fromDate: AbstractDate = today(),
) => {
  // Convert duration to weeks for weekday alignment
  // Need to use Math.floor or else:
  //  1 month is 4.285714285714286 weeks,
  //  1 year 52.14285714... etc.
  const numWeeks = Math.floor(
    dayjs.duration(1, periodName as DurationUnitType).asWeeks(),
  );

  return dayjs.utc(fromDate).subtract(numWeeks, 'weeks');
};

const genericPeriods = Object.fromEntries<DateRangeConfig>(
  (['week', 'month', 'year'] as const).map((type) => [
    type,
    {
      type,
      label: `Last ${type}`,
      getDateRange: partial(getPeriodDateRange, [type]),
      getComparisonDate: partial(getComparisonDate, [type]),
    },
  ]),
);

const quarterlyConfig: DateRangeConfig = {
  type: 'quarter',
  label: 'Last quarter',
  getDateRange: partial(getPeriodDateRange, ['quarter']),
  getComparisonDate: function (fromDate = today()) {
    const numWeeks = Math.floor(dayjs.duration(3, 'months').asWeeks());

    const fromDateStart = this.getDateRange(fromDate).start;

    const sevenDaysAfterCurrentStart = fromDateStart.add(7, 'days');
    const sevenDaysBeforeCurrentStart = fromDateStart.subtract(7, 'days');

    // if the comparison date isn't within 7 days of the start date,
    //   we can assume it's the start date

    const comparisonDate = dayjs.utc(fromDate).subtract(numWeeks, 'weeks');

    const isStart = comparisonDate.isBetween(
      sevenDaysBeforeCurrentStart,
      sevenDaysAfterCurrentStart,
      null,
      '[]',
    );

    if (
      !comparisonDate.isBefore(sevenDaysAfterCurrentStart) ||
      (isStart &&
        comparisonDate.diff(comparisonDate.endOf('quarter'), 'days') < 90)
    ) {
      return comparisonDate.subtract(1, 'weeks');
    }

    return comparisonDate;
  },
};

export const structuredDateRangeConfigs = {
  week: genericPeriods['week'],
  month: genericPeriods['month'],
  quarter: quarterlyConfig,
  year: genericPeriods['year'],
  fiscal_year: {
    type: 'fiscal_year',
    label: 'Last fiscal year',
    getDateRange: (fromDate = today()) => {
      const datejs = dayjs.utc(fromDate);

      const currentYearEnd = datejs.month(2).endOf('month').startOf('day');

      const endIsPreviousYear = currentYearEnd.isAfter(datejs);

      const end = endIsPreviousYear
        ? currentYearEnd.subtract(1, 'year')
        : currentYearEnd;

      return {
        start: end.subtract(1, 'year').add(1, 'day'),
        end,
      };
    },
    getComparisonDate: (fromDate = today()) =>
      dayjs.utc(fromDate).subtract(52, 'weeks'),
  },
  last_52_weeks: {
    type: 'last_52_weeks',
    label: 'Last 52 weeks',
    getDateRange: (fromDate = today()) => {
      const end = dayjs.utc(fromDate).startOf('week').subtract(1, 'day');
      const start = end.startOf('week').subtract(51, 'weeks'); // 51 weeks + end week = 52 weeks

      return { start, end };
    },
    getComparisonDate: (fromDate = today()) =>
      dayjs.utc(fromDate).subtract(52, 'weeks'),
  },
  year_to_date: {
    type: 'year_to_date',
    label: 'Year to date',
    getDateRange: (fromDate = today()) => {
      const end = dayjs.utc(fromDate).subtract(1, 'day').startOf('day');
      const start = end.startOf('year');

      return { start, end };
    },
    getComparisonDate: (fromDate = today()) =>
      dayjs.utc(fromDate).subtract(52, 'weeks'),
  },
} as const;

export const dateRangeConfigs: readonly DateRangeConfig[] = Object.freeze(
  Object.values(structuredDateRangeConfigs) as DateRangeConfig[],
);

export const getDateRangesWithComparison = (options?: {
  asDate?: boolean;
  asDayjs?: boolean;
}) =>
  dateRangeConfigs
    .map((config) => {
      const dateRange = config.getDateRange();
      const comparisonDateRange = {
        start: config.getComparisonDate(dateRange.start),
        end: config.getComparisonDate(dateRange.end),
      };

      if (options?.asDayjs) {
        return [dateRange, comparisonDateRange];
      }

      const toOutput = (dateRange: DateRange<Dayjs>) =>
        options?.asDate
          ? ({
              start: dateRange.start.toDate(),
              end: dateRange.end.toDate(),
            } as DateRange<Date>)
          : ({
              start: dateRange.start.format('YYYY-MM-DD'),
              end: dateRange.end.format('YYYY-MM-DD'),
            } as DateRange<string>);

      return [toOutput(dateRange), toOutput(comparisonDateRange)];
    })
    .flat();

export type StructuredDateRangeWithComparison<T extends AbstractDate> = {
  dateRange: DateRange<T>;
  comparisonDateRange: DateRange<T>;
};

function getStructuredDateRange(
  type: keyof typeof structuredDateRangeConfigs,
  asDate: true,
): StructuredDateRangeWithComparison<Date>;
function getStructuredDateRange(
  type: keyof typeof structuredDateRangeConfigs,
  asDate: false,
): StructuredDateRangeWithComparison<Dayjs>;
function getStructuredDateRange(
  type: keyof typeof structuredDateRangeConfigs,
): StructuredDateRangeWithComparison<Dayjs>;
function getStructuredDateRange(
  type: keyof typeof structuredDateRangeConfigs,
  asDate = false,
) {
  const dateRange = structuredDateRangeConfigs[type].getDateRange();

  const dateRanges = {
    dateRange,
    comparisonDateRange: {
      start: structuredDateRangeConfigs[type].getComparisonDate(
        dateRange.start,
      ),
      end: structuredDateRangeConfigs[type].getComparisonDate(dateRange.end),
    },
  };

  if (asDate) {
    return {
      dateRange: {
        start: dateRanges.dateRange.start.toDate(),
        end: dateRanges.dateRange.end.toDate(),
      },
      comparisonDateRange: {
        start: dateRanges.comparisonDateRange.start.toDate(),
        end: dateRanges.comparisonDateRange.end.toDate(),
      },
    };
  }

  return dateRanges;
}

export const getStructuredDateRangesWithComparison = () => ({
  week: getStructuredDateRange('week'),
  month: getStructuredDateRange('month'),
  quarter: getStructuredDateRange('quarter'),
  year: getStructuredDateRange('year'),
  fiscal_year: getStructuredDateRange('fiscal_year'),
  last_52_weeks: getStructuredDateRange('last_52_weeks'),
  year_to_date: getStructuredDateRange('year_to_date'),
});

export type GetDateRangeOptions = {
  asDate?: boolean;
  withComparison: boolean;
};

const getDateRangeDefaults = {
  asDate: true,
  withComparison: false,
} as const;

export function getDateRange(type: DateRangeType): DateRange<Date>;
export function getDateRange(
  type: DateRangeType,
  options: GetDateRangeOptions & { asDate: false },
): DateRange<Dayjs>;
export function getDateRange(
  type: DateRangeType,
  options: GetDateRangeOptions & { withComparison: true },
): ReturnType<typeof getStructuredDateRange>;

export function getDateRange(
  type: DateRangeType,
  options: GetDateRangeOptions = getDateRangeDefaults,
) {
  // basically just a type guard
  if (type === 'custom') {
    throw new Error('Cannot get date range for custom type');
  }

  const mergedOptions = { ...getDateRangeDefaults, ...options };

  const withComparison = mergedOptions.asDate
    ? getStructuredDateRange(type, mergedOptions.asDate)
    : getStructuredDateRange(type);

  if (options.withComparison) {
    return withComparison;
  }

  return withComparison.dateRange;
}

export function createCustomDateRangePeriod(
  dateRangeString: string,
  comparisonDateRangeString: string,
) {
  const [dateRangeStringStart, dateRangeStringEnd] = dateRangeString.split('/');
  const [comparisonDateRangeStringStart, comparisonDateRangeStringEnd] =
    comparisonDateRangeString.split('/');

  const dateRange = {
    start: dayjs.utc(dateRangeStringStart),
    end: dayjs.utc(dateRangeStringEnd),
  };

  const comparisonDateRange = {
    start: dayjs.utc(comparisonDateRangeStringStart),
    end: dayjs.utc(comparisonDateRangeStringEnd),
  };

  const currentDates = datesFromDateRange(dateRange, false, true) as Date[];
  const prevDates = datesFromDateRange(
    comparisonDateRange,
    false,
    true,
  ) as Date[];

  return {
    type: 'custom' as DateRangeType,
    label: 'Custom',
    dateRange,
    comparisonDateRange,
    dates: new Map(
      zip(
        prevDates.map((date) => date.toISOString()),
        currentDates.map((date) => date.toISOString()),
      ) as [string, string][],
    ),
  };
}

/**
 * From seconds to milliseconds
 * @param num
 */
export const seconds = (num: number) => num * 1000;

/**
 * From minutes to milliseconds
 * @param num
 */
export const minutes = (num: number) => seconds(num * 60);

/**
 * From hours to milliseconds
 * @param num
 */
export const hours = (num: number) => minutes(num * 60);

/**
 * From days to milliseconds
 * @param num
 */
export const days = (num: number) => hours(num * 24);

export type DateRangeGranularity = 'day' | 'week' | 'month' | 'year';

export type GranularityPeriod =
  | {
      start: string;
      end: string;
    }
  | {
      start: Date;
      end: Date;
    };

export function dateRangeToGranularity(
  dateRange: DateRange<string> | DateRange<Date>,
  granularity: DateRangeGranularity = 'day',
  format: string | false = 'YYYY-MM-DD',
  inclusive = false,
) {
  const periodStartDates: Dayjs[] = [];

  // currentPeriodStart won't necessarily be the start of the period
  // if the dateRange start is not aligned with the granularity
  // (same for end date)
  let currentPeriodStart = dayjs.utc(dateRange.start).startOf('day');

  const endDate = inclusive
    ? dayjs.utc(dateRange.end).add(1, 'day')
    : dayjs.utc(dateRange.end).endOf('day');

  if (endDate.isBefore(currentPeriodStart)) {
    throw Error('Invalid dateRange - end is before start');
  }

  while (currentPeriodStart.isBefore(endDate)) {
    periodStartDates.push(currentPeriodStart);
    currentPeriodStart = currentPeriodStart.add(1, granularity);
  }

  const endDates = periodStartDates
    .slice(1)
    .map((start) => start.subtract(1, 'ms'));

  endDates.push(endDate);

  const toOutput = format
    ? (date: Dayjs) => date.format(format)
    : (date: Dayjs) => date.toDate();

  return zip(periodStartDates, endDates).map(([start, end]) => ({
    start: toOutput(start),
    end: toOutput(end),
  })) as GranularityPeriod[];
}
