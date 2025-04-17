import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  TASKS_DETAILS_FEATURE_KEY,
  TasksDetailsState,
} from './tasks-details.reducer';
import {
  selectCurrentLang,
  selectComparisonDateRange,
  selectDatePeriodSelection,
  selectDateRange,
  selectDateRangeLabel,
  selectPeriodDates,
} from '@dua-upd/upd/state';
import { arrayToDictionary, logJson } from '@dua-upd/utils-common';
import { I18nModule, I18nService } from '@dua-upd/upd/i18n';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { is } from 'rambdax';

dayjs.extend(utc);

export type DateTimeSeriesData = {
  x: string;
  y: number;
}[];

// Lookup the 'TasksDetails' feature state managed by NgRx
export const selectTasksDetailsState = createFeatureSelector<TasksDetailsState>(
  TASKS_DETAILS_FEATURE_KEY,
);

export const selectTasksDetailsLoaded = createSelector(
  selectTasksDetailsState,
  (state: TasksDetailsState) => state.loaded,
);

export const selectTasksDetailsLoading = createSelector(
  selectTasksDetailsState,
  (state: TasksDetailsState) => state.loading,
);

export const selectTasksDetailsError = createSelector(
  selectTasksDetailsState,
  (state: TasksDetailsState) => state.error,
);

export const selectTasksDetailsData = createSelector(
  selectTasksDetailsState,
  (state: TasksDetailsState) => state.data,
);

export const selectTasksDetailsDataWithI18n = createSelector(
  selectTasksDetailsData,
  selectCurrentLang,
  (data, lang) => [data, lang] as const,
);

// data select (current/previous)
export const selectCurrentData = createSelector(
  selectTasksDetailsData,
  ({ dateRangeData }) => dateRangeData,
);

export const selectComparisonData = createSelector(
  selectTasksDetailsData,
  ({ comparisonDateRangeData }) => comparisonDateRangeData,
);

export const selectCurrentDateRangeLabel =
  selectDateRangeLabel(selectDateRange);

export const selectComparisonDateRangeLabel = selectDateRangeLabel(
  selectComparisonDateRange,
);

export const selectTaskId = createSelector(
  selectTasksDetailsData,
  (data) => data?._id,
);

export const selectFeedbackMostRelevant = createSelector(
  selectTasksDetailsData,
  (data) => data?.mostRelevantCommentsAndWords,
);

export const selectCallsPerVisitsChartData = createSelector(
  selectTasksDetailsData,
  selectPeriodDates,
  selectCurrentDateRangeLabel,
  selectComparisonDateRangeLabel,
  (
    { dateRangeData, comparisonDateRangeData },
    dates,
    currentLabel,
    comparisonLabel,
  ) => {
    const i18n = I18nModule.injector.get<I18nService>(I18nService);

    const callsByDay = dateRangeData?.callsPer100VisitsByDay || [];
    const comparisonCallsByDay =
      comparisonDateRangeData?.callsPer100VisitsByDay || [];

    const callsPerVisitsSeries = callsByDay.map(({ date, calls }) => ({
      x: date,
      y: calls,
    }))
    .filter(({ y }) => y);

    const comparisonCallsPerVisitsSeries = comparisonCallsByDay
      .filter(({ date }) => dates.has(date))
      .map(({ date, calls }) => ({
        x: dates.get(date),
        y: calls,
      }))
      .filter(({ y }) => y);

    const isCallsPerVisitsEmpty = callsPerVisitsSeries.every(
      ({ y }) => y === 0 || isNaN(y),
    );
    const isComparisonCallsPerVisitsEmpty =
      comparisonCallsPerVisitsSeries.every(({ y }) => y === 0 || isNaN(y));

    if (isCallsPerVisitsEmpty && isComparisonCallsPerVisitsEmpty) {
      return [];
    }

    return [
      {
        name: `${i18n.instant('kpi-calls-per-100-title')} – ${comparisonLabel}`,
        type: 'line',
        data: comparisonCallsPerVisitsSeries,
      },
      {
        name: `${i18n.instant('kpi-calls-per-100-title')} – ${currentLabel}`,
        type: 'line',
        data: callsPerVisitsSeries,
      },
    ];
  },
);

// Feedback to visits ratio
export const selectDyfNoPerVisitsSeries = createSelector(
  selectTasksDetailsData,
  selectCurrentDateRangeLabel,
  selectComparisonDateRangeLabel,
  selectPeriodDates,
  (
    { dateRangeData, comparisonDateRangeData },
    dateRangeLabel,
    comparisonDateRangeLabel,
    dates,
  ) => {
    const dyfByDay = dateRangeData?.dyfNoPer1000VisitsByDay || [];
    const comparisonDyfByDay =
      comparisonDateRangeData?.dyfNoPer1000VisitsByDay || [];

    const dyfNoPerVisitsSeries = dyfByDay.map(({ date, dyfNo }) => ({
      x: date,
      y: dyfNo,
    }));

    const comparisonDyfNoPerVisitsSeries = comparisonDyfByDay
      .map(({ date, dyfNo }) => ({
        x: dates.get(date),
        y: dyfNo,
      }))
      .filter(({ x }) => x);

    const isDyfNoPerVisitsEmpty = dyfNoPerVisitsSeries.every(
      ({ y }) => y === 0 || isNaN(y),
    );
    const isComparisonDyfNoPerVisitsEmpty =
      comparisonDyfNoPerVisitsSeries.every(({ y }) => y === 0 || isNaN(y));

    if (isDyfNoPerVisitsEmpty && isComparisonDyfNoPerVisitsEmpty) {
      return [];
    }

    return [
      {
        name: comparisonDateRangeLabel,
        type: 'line',
        data: comparisonDyfNoPerVisitsSeries,
      },
      {
        name: dateRangeLabel,
        type: 'line',
        data: dyfNoPerVisitsSeries,
      },
    ];
  },
);