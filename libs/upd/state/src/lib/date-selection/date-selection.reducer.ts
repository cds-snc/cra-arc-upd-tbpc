import { createReducer, on, Action } from '@ngrx/store';
import { zip } from 'rambdax';
import {
  Dayjs,
  DateRangeType,
  DateRangeConfig,
  dateRangeConfigs,
  datesFromDateRange,
  createCustomDateRangePeriod,
} from '@dua-upd/utils-common';
import type { DateRange } from '@dua-upd/types-common';

import * as DateSelectionActions from './date-selection.actions';

export interface DateRangePeriod {
  type: DateRangeType;
  // translation key for dropdown label
  label: string;
  dateRange: DateRange<Dayjs>;
  comparisonDateRange: DateRange<Dayjs>;
  // Maps comparison dates to current dates (both as ISOString)
  dates: Map<string, string>;
}

export const DATE_SELECTION_FEATURE_KEY = 'dateSelection';

export interface DateSelectionState {
  periodSelection: DateRangeType;
  dateRange: string;
  comparisonDateRange: string;
}

export interface DateSelectionPartialState {
  readonly [DATE_SELECTION_FEATURE_KEY]: DateSelectionState;
}

export const predefinedDateRanges = Object.fromEntries(
  dateRangeConfigs.map((config) => [
    config.type,
    createPredefinedDateRange(config),
  ]),
);

const initialPeriodSelection = predefinedDateRanges['week'];
export const initialState: DateSelectionState = {
  // set initial required properties
  periodSelection: initialPeriodSelection.type,
  dateRange: toDateRangeString(initialPeriodSelection.dateRange),
  comparisonDateRange: toDateRangeString(
    initialPeriodSelection.comparisonDateRange,
  ),
};

const reducer = createReducer(
  initialStateFromQueryParams(),
  on(
    DateSelectionActions.selectDatePeriod,
    (state, period): DateSelectionState => {
      if (period.selection === state.periodSelection) {
        return state;
      }

      const selectedPeriod = predefinedDateRanges[period.selection];

      return {
        periodSelection: period.selection,
        dateRange:
          period.customDateRange || toDateRangeString(selectedPeriod.dateRange),
        comparisonDateRange:
          period.customComparisonDateRange ||
          toDateRangeString(selectedPeriod.comparisonDateRange),
      };
    },
  ),
);

export function dateSelectionReducer(
  state: DateSelectionState | undefined,
  action: Action,
) {
  return reducer(state, action);
}

export function createPredefinedDateRange(
  config: DateRangeConfig,
): DateRangePeriod {
  const dateRange = config.getDateRange();

  const daysBetween = dateRange.end.diff(dateRange.start, 'days');

  const comparisonDateRange = {
    start: config.getComparisonDate(dateRange.start),
    end: config.getComparisonDate(dateRange.end),
  };

  const prevDaysBetween = comparisonDateRange.end.diff(
    comparisonDateRange.start,
    'days',
  );

  if (daysBetween !== prevDaysBetween) {
    throw Error('days between dateRanges should be equal');
  }

  const currentDates = datesFromDateRange(dateRange, false, true) as Date[];
  const prevDates = datesFromDateRange(
    comparisonDateRange,
    false,
    true,
  ) as Date[];

  const dates = new Map(
    zip(
      prevDates.map((date) => date.toISOString()),
      currentDates.map((date) => date.toISOString()),
    ) as [string, string][],
  );

  return {
    type: config.type,
    label: config.label,
    dateRange,
    comparisonDateRange,
    dates,
  };
}

export function toDateRangeString(dateRange: DateRange<Dayjs>) {
  return `${dateRange.start.format('YYYY-MM-DD')}/${dateRange.end.format(
    'YYYY-MM-DD',
  )}`;
}

export function initialStateFromQueryParams(): DateSelectionState {
  const queryParams = Object.fromEntries(
    [...new URLSearchParams(location.search).entries()].filter(([key]) =>
      [
        'dateRange',
        'comparisonDateRange',
        'customDateRange',
        'customComparisonDateRange',
      ].includes(key),
    ),
  );

  if (queryParams['customDateRange'] && queryParams['customComparisonDateRange']) {
    // if custom date range -> add to predefinedDateRanges

    const customDateRangePeriod = createCustomDateRangePeriod(queryParams['customDateRange'], queryParams['customComparisonDateRange']);

    predefinedDateRanges['custom'] = customDateRangePeriod;

    return {
      periodSelection: 'custom',
      dateRange: queryParams['customDateRange'],
      comparisonDateRange: queryParams['customComparisonDateRange'],
    };
  }

  const dateRange = queryParams['dateRange'];
  const comparisonDateRange = queryParams['comparisonDateRange'];

  const matchingPeriod = Object.values(predefinedDateRanges).find(
    (period) =>
      toDateRangeString(period.dateRange) === dateRange &&
      toDateRangeString(period.comparisonDateRange) === comparisonDateRange,
  );

  if (matchingPeriod) {
    return {
      periodSelection: matchingPeriod.type,
      dateRange: toDateRangeString(matchingPeriod.dateRange),
      comparisonDateRange: toDateRangeString(
        matchingPeriod.comparisonDateRange,
      ),
    };
  }

  return initialState;
}
