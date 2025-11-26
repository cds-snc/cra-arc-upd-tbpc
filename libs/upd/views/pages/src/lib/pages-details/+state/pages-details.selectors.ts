import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  PAGES_DETAILS_FEATURE_KEY,
  PagesDetailsState,
} from './pages-details.reducer';
import {
  selectComparisonDateRange,
  selectCurrentLang,
  selectDatePeriodSelection,
  selectDateRange,
  selectDateRangeLabel,
  selectPeriodDates,
} from '@dua-upd/upd/state';
import { arrayToDictionary, DateRangeType } from '@dua-upd/utils-common';
import dayjs from 'dayjs';

// Lookup the 'PagesDetails' feature state managed by NgRx
export const selectPagesDetailsState = createFeatureSelector<PagesDetailsState>(
  PAGES_DETAILS_FEATURE_KEY
);

export const selectPagesDetailsLoaded = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.loaded
);

export const selectPagesDetailsLoading = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.loading
);

export const selectPagesDetailsError = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.error
);

export const selectPagesDetailsData = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.data
);

export const selectHashesLoaded = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.loadedHashes
);

export const selectHashesLoading = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.loadingHashes
);

export const selectHashesData = createSelector(
  selectPagesDetailsData,
  (data) => data?.hashes,
);

// data select (current/previous)
export const selectCurrentData = createSelector(
  selectPagesDetailsData,
  ({ dateRangeData }) => dateRangeData
);

export const selectComparisonData = createSelector(
  selectPagesDetailsData,
  ({ comparisonDateRangeData }) => comparisonDateRangeData
);

export const selectCurrentDateRangeLabel =
  selectDateRangeLabel(selectDateRange);

export const selectComparisonDateRangeLabel = selectDateRangeLabel(
  selectComparisonDateRange
);

export const selectReadabilityData = createSelector(
  selectPagesDetailsData,
  ({ readability }) => readability
);

export const selectPageLang = createSelector(
  selectPagesDetailsData,
  ({ url }) => /canada\.ca\/(en|fr)/i.exec(url)?.[1] || null
);

export const selectNumComments = createSelector(
  selectPagesDetailsData,
  (data) => data?.numComments,
);

export const selectNumCommentsPercentChange = createSelector(
  selectPagesDetailsData,
  (data) => data?.numCommentsPercentChange,
);

// Feedback - comments/words
export const selectFeedbackCommentsAndWords = createSelector(
  selectPagesDetailsData,
  (data) => data?.commentsAndWords,
);

/*
 * chart/table/component-level
 */

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

export const selectChartType = createSelector(
  selectDatePeriodSelection,
  (dateRangePeriod) =>
    (['week', 'month'] as DateRangeType[]).includes(dateRangePeriod)
      ? 'column'
      : 'line'
);

export const selectCurrentVisitsByDayChartData = createSelector(
  selectCurrentDateRangeLabel,
  selectVisitsByDaySeries,
  selectChartType,
  (label, visits, chartType) => ({
    name: label,
    data: visits,
    type: chartType,
  })
);

export const selectComparisonVisitsByDayChartData = createSelector(
  selectComparisonDateRangeLabel,
  selectComparisonVisitsByDaySeries,
  selectChartType,
  (label, visits, chartType) => ({
    name: label,
    data: visits,
    type: chartType,
  })
);

export const selectVisitsByDayChartData = createSelector(
  selectCurrentVisitsByDayChartData,
  selectComparisonVisitsByDayChartData,
  // pretty hacky, but this works for now
  (data, prevData) => [data, prevData]
);
export const selectVisitsByDayChartTable = createSelector(
  selectPeriodDates,
  selectVisitsByDay,
  selectComparisonVisitsByDay,
  selectCurrentLang,
  selectDatePeriodSelection,
  (dates, visits, prevVisits, lang, dateRangePeriod) => {
    const visitsDict = arrayToDictionary(visits, 'date');
    const prevVisitsDict = arrayToDictionary(prevVisits, 'date');

    const dateFormat =
      dateRangePeriod === 'week' ? 'dddd, MMM D' : 'MMM D YYYY';

    return [...dates].map(([prevDate, currentDate]) => ({
      date: dayjs.utc(currentDate).locale(lang).format(dateFormat),
      visits: visitsDict[currentDate]?.visits,
      prevDate: dayjs.utc(prevDate).locale(lang).format(dateFormat),
      prevVisits: prevVisitsDict[prevDate]?.visits,
    }));
  }
);

// Feedback to visits ratio
export const selectDyfNoPerVisitsSeries = createSelector(
  selectPagesDetailsData,
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

export const selectAccessibilityData = createSelector(
  selectPagesDetailsState,
  selectPagesDetailsData,
  (state: PagesDetailsState, pageData) => {
    const currentUrl = pageData?.url;
    if (!currentUrl) return null;
    return state.accessibilityByUrl[currentUrl] || null;
  }
);

export const selectAccessibilityLoaded = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.loadedAccessibility
);

export const selectAccessibilityLoading = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.loadingAccessibility
);

export const selectAccessibilityError = createSelector(
  selectPagesDetailsState,
  (state: PagesDetailsState) => state.errorAccessibility
);
