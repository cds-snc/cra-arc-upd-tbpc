import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  PROJECTS_DETAILS_FEATURE_KEY,
  ProjectsDetailsState,
} from './projects-details.reducer';
import {
  selectComparisonDateRange,
  selectDatePeriodSelection,
  selectDateRange,
  selectDateRangeLabel,
  selectPeriodDates,
} from '@dua-upd/upd/state';
import { arrayToDictionary } from '@dua-upd/utils-common';
import { I18nModule, I18nService } from '@dua-upd/upd/i18n';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export type DateTimeSeriesData = {
  x: string;
  y: number;
}[];

// Lookup the 'ProjectsDetails' feature state managed by NgRx
export const selectProjectsDetailsState =
  createFeatureSelector<ProjectsDetailsState>(PROJECTS_DETAILS_FEATURE_KEY);

export const selectProjectsDetailsLoaded = createSelector(
  selectProjectsDetailsState,
  (state: ProjectsDetailsState) => state.loaded
);

export const selectProjectsDetailsLoading = createSelector(
  selectProjectsDetailsState,
  (state: ProjectsDetailsState) => state.loading
);

export const selectProjectsDetailsError = createSelector(
  selectProjectsDetailsState,
  (state: ProjectsDetailsState) => state.error
);

export const selectProjectsDetailsData = createSelector(
  selectProjectsDetailsState,
  (state: ProjectsDetailsState) => state.data
);

// data select (current/previous)
export const selectCurrentData = createSelector(
  selectProjectsDetailsData,
  ({ dateRangeData }) => dateRangeData
);

export const selectComparisonData = createSelector(
  selectProjectsDetailsData,
  ({ comparisonDateRangeData }) => comparisonDateRangeData
);

export const selectCurrentDateRangeLabel =
  selectDateRangeLabel(selectDateRange);

export const selectComparisonDateRangeLabel = selectDateRangeLabel(
  selectComparisonDateRange
);

// Feedback - most relevant comments/words
export const selectFeedbackCommentsAndWords = createSelector(
  selectProjectsDetailsData,
  (data) => data?.commentsAndWords,
);

// Visits by day
export const selectVisitsByDay = createSelector(
  selectCurrentData,
  (data) => data?.visitsByDay || []
);
export const selectVisitsByDaySeries = createSelector(
  selectVisitsByDay,
  (visitsByDay) =>
    visitsByDay.map(({ date, visits }) => ({
      x: date,
      y: visits,
    }))
);

export const selectComparisonVisitsByDay = createSelector(
  selectComparisonData,
  (data) => data?.visitsByDay || []
);
export const selectComparisonVisitsByDaySeries = createSelector(
  selectComparisonVisitsByDay,
  selectPeriodDates,
  (visitsByDay, dates) =>
    visitsByDay
      .filter(({ date }) => dates.has(date))
      .map(({ date, visits }) => ({
        x: dates.get(date) as string,
        y: visits,
      }))
);

// Calls by day
export const selectCallsByDay = createSelector(
  selectCurrentData,
  (data) => data?.calldriversByDay || []
);
export const selectCallsByDaySeries = createSelector(
  selectCallsByDay,
  (callsByDay) =>
    callsByDay.map(({ date, calls }) => ({
      x: date,
      y: calls,
    }))
);

export const selectComparisonCallsByDay = createSelector(
  selectComparisonData,
  (data) => data?.calldriversByDay || []
);
export const selectComparisonCallsByDaySeries = createSelector(
  selectComparisonCallsByDay,
  selectPeriodDates,
  (callsByDay, dates) =>
    callsByDay
      .filter(({ date }) => dates.has(date))
      .map(({ date, calls }) => ({
        x: dates.get(date) as string,
        y: calls,
      }))
);

// Calls per 100 visits
export const selectCallsPerVisits = createSelector(
  selectCallsByDay,
  selectVisitsByDay,
  (callsByDay, visitsByDay) => {
    const callsByDateDict = arrayToDictionary(callsByDay, 'date');

    return visitsByDay
      .map(({ date, visits }) => {
        const calls = callsByDateDict[date]?.calls;

        return {
          x: date,
          y: calls ? (calls / visits) * 100 : 0,
        };
      })
      .filter(({ y }) => y);  // allow valid 0 values
  }
);

export const selectComparisonCallsPerVisits = createSelector(
  selectComparisonCallsByDay,
  selectComparisonVisitsByDay,
  selectPeriodDates,
  (callsByDay, visitsByDay, dates) => {
    const callsByDateDict = arrayToDictionary(callsByDay, 'date');

    return visitsByDay
      .filter(({ date }) => dates.has(date))
      .map(({ date, visits }) => {
        const calls = callsByDateDict[date]?.calls;

        return {
          x: dates.get(date) as string,
          y: calls ? (calls / visits) * 100 : 0,
        };
      })
      .filter(({ y }) => y);
  }
);

export const toCallsPerVisitsSeries =
  (label: string) =>
  (datesLabel: string, callsPerVisits: DateTimeSeriesData) => {
    const i18n = I18nModule.injector.get<I18nService>(I18nService);

    return {
      name: `${i18n.instant(label) || label} – ${datesLabel}`,
      type: 'line',
      data: callsPerVisits,
    };
  };

export const selectCallsPerVisitsSeries = createSelector(
  selectCurrentDateRangeLabel,
  selectCallsPerVisits,
  selectDatePeriodSelection,
  toCallsPerVisitsSeries('kpi-calls-per-100-title')
);

export const selectComparisonCallsPerVisitsSeries = createSelector(
  selectComparisonDateRangeLabel,
  selectComparisonCallsPerVisits,
  selectDatePeriodSelection,
  toCallsPerVisitsSeries('kpi-calls-per-100-title')
);

export const selectCallsPerVisitsChartData = createSelector(
  selectCallsPerVisitsSeries,
  selectComparisonCallsPerVisitsSeries,
  (current, comparison) => {
    const isCurrentEmpty = current.data.every(({ y }) => y === 0);
    const isComparisonEmpty = comparison.data.every(({ y }) => y === 0);

    if (isCurrentEmpty && isComparisonEmpty) {
      return [];
    }

    return [comparison, current];
  }
);

// Feedback to visits ratio
export const selectDyfNoPerVisitsSeries = createSelector(
  selectProjectsDetailsData,
  selectCurrentDateRangeLabel,
  selectComparisonDateRangeLabel,
  selectPeriodDates,
  (
    { dateRangeData, comparisonDateRangeData },
    dateRangeLabel,
    comparisonDateRangeLabel,
    dates
  ) => {
    const dyfByDay = dateRangeData?.dyfByDay || [];
    const visitsByDay = dateRangeData?.visitsByDay || [];
    const dyfDict = arrayToDictionary(dyfByDay, 'date');

    const dyfNoPerVisitsSeries = visitsByDay.map(({ date, visits }) => ({
      x: date,
      y: visits ? ((dyfDict[date]?.dyf_no || 0) / visits) * 1000 : NaN,
    }));

    const comparisonDyfByDay = comparisonDateRangeData?.dyfByDay || [];
    const comparisonVisitsByDay = comparisonDateRangeData?.visitsByDay || [];
    const comparisonDyfDict = arrayToDictionary(comparisonDyfByDay, 'date');

    const comparisonDyfNoPerVisitsSeries = comparisonVisitsByDay
      .filter(({ date }) => dates.has(date))
      .map(({ date, visits }) => {
        const currentDate = dates.get(date);

        return {
          x: currentDate,
          y:
            visits && currentDate
              ? ((comparisonDyfDict[date]?.dyf_no || 0) / visits) * 1000
              : NaN,
        };
      });

    const isDyfNoPerVisitsEmpty = dyfNoPerVisitsSeries.every(
      ({ y }) => y === 0 || isNaN(y)
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
  }
);
