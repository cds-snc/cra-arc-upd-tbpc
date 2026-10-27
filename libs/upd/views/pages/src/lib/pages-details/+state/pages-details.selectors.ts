import { createFeatureSelector, createSelector } from '@ngrx/store';
import type { PagesDetailsState } from './pages-details.reducer';
import { PAGES_DETAILS_FEATURE_KEY } from './pages-details.reducer';
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

// Factory so selectors can be bound to a different feature key (e.g. for
// `portal-pages`, which stores its data under its own feature slice).
export function createPagesDetailsSelectors(featureKey: string) {
  // Lookup the 'PagesDetails' feature state managed by NgRx
  const selectPagesDetailsState =
    createFeatureSelector<PagesDetailsState>(featureKey);

  const selectPagesDetailsLoaded = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.loaded,
  );

  const selectPagesDetailsLoading = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.loading,
  );

  const selectPagesDetailsError = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.error,
  );

  const selectPagesDetailsData = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.data,
  );

  const selectHashesLoaded = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.loadedHashes,
  );

  const selectHashesLoading = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.loadingHashes,
  );

  const selectHashesData = createSelector(
    selectPagesDetailsData,
    (data) => data?.hashes,
  );

  // data select (current/previous)
  const selectCurrentData = createSelector(
    selectPagesDetailsData,
    ({ dateRangeData }) => dateRangeData,
  );

  const selectComparisonData = createSelector(
    selectPagesDetailsData,
    ({ comparisonDateRangeData }) => comparisonDateRangeData,
  );

  const selectCurrentDateRangeLabel = selectDateRangeLabel(selectDateRange);

  const selectComparisonDateRangeLabel = selectDateRangeLabel(
    selectComparisonDateRange,
  );

  const selectReadabilityData = createSelector(
    selectPagesDetailsData,
    ({ readability }) => readability,
  );

  const selectPageLang = createSelector(
    selectPagesDetailsData,
    (data) =>
      (data as { lang?: 'en' | 'fr' }).lang ||
      /canada\.ca\/(en|fr)/i.exec(data.url)?.[1] ||
      null,
  );

  const selectNumComments = createSelector(
    selectPagesDetailsData,
    (data) => data?.numComments,
  );

  const selectNumCommentsPercentChange = createSelector(
    selectPagesDetailsData,
    (data) => data?.numCommentsPercentChange,
  );

  // Feedback - comments/words
  const selectFeedbackCommentsAndWords = createSelector(
    selectPagesDetailsData,
    (data) => data?.commentsAndWords,
  );

  /*
   * chart/table/component-level
   */

  const selectVisitsByDay = createSelector(
    selectCurrentData,
    (data) => data?.visitsByDay || [],
  );
  const selectVisitsByDaySeries = createSelector(
    selectVisitsByDay,
    (visitsByDay) =>
      visitsByDay.map(({ date, visits }) => ({
        x: date,
        y: visits,
      })),
  );

  const selectComparisonVisitsByDay = createSelector(
    selectComparisonData,
    (data) => data?.visitsByDay || [],
  );
  const selectComparisonVisitsByDaySeries = createSelector(
    selectComparisonVisitsByDay,
    selectPeriodDates,
    (visitsByDay, dates) =>
      visitsByDay
        .filter(({ date }) => dates.has(date))
        .map(({ date, visits }) => ({
          x: dates.get(date) as string,
          y: visits,
        })),
  );

  const selectChartType = createSelector(
    selectDatePeriodSelection,
    (dateRangePeriod) =>
      (['week', 'month'] as DateRangeType[]).includes(dateRangePeriod)
        ? 'column'
        : 'line',
  );

  const selectCurrentVisitsByDayChartData = createSelector(
    selectCurrentDateRangeLabel,
    selectVisitsByDaySeries,
    selectChartType,
    (label, visits, chartType) => ({
      name: label,
      data: visits,
      type: chartType,
    }),
  );

  const selectComparisonVisitsByDayChartData = createSelector(
    selectComparisonDateRangeLabel,
    selectComparisonVisitsByDaySeries,
    selectChartType,
    (label, visits, chartType) => ({
      name: label,
      data: visits,
      type: chartType,
    }),
  );

  const selectVisitsByDayChartData = createSelector(
    selectCurrentVisitsByDayChartData,
    selectComparisonVisitsByDayChartData,
    // pretty hacky, but this works for now
    (data, prevData) => [data, prevData],
  );
  const selectVisitsByDayChartTable = createSelector(
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
    },
  );

  // Feedback to visits ratio
  const selectDyfNoPerVisitsSeries = createSelector(
    selectPagesDetailsData,
    selectCurrentDateRangeLabel,
    selectComparisonDateRangeLabel,
    selectPeriodDates,
    (
      { dateRangeData, comparisonDateRangeData },
      dateRangeLabel,
      comparisonDateRangeLabel,
      dates,
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

  const selectAccessibilityData = createSelector(
    selectPagesDetailsState,
    selectPagesDetailsData,
    (state: PagesDetailsState, pageData) => {
      const currentUrl = pageData?.url;
      if (!currentUrl) return null;
      return state.accessibilityByUrl[currentUrl] || null;
    },
  );

  const selectAccessibilityLoaded = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.loadedAccessibility,
  );

  const selectAccessibilityLoading = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.loadingAccessibility,
  );

  const selectAccessibilityError = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.errorAccessibility,
  );

  const selectPageHighlightsKey = createSelector(
    selectPagesDetailsData,
    selectCurrentLang,
    (data, lang) =>
      data?.url
        ? `${data.url}|${data.dateRange}|${data.comparisonDateRange || ''}|${lang === 'fr-CA' ? 'fr' : 'en'}`
        : null,
  );

  const selectPageHighlights = createSelector(
    selectPagesDetailsState,
    selectPageHighlightsKey,
    (state: PagesDetailsState, key) =>
      key ? state.pageHighlightsByKey[key] || null : null,
  );

  const selectPageHighlightsLoading = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.loadingPageHighlights,
  );

  const selectPageHighlightsError = createSelector(
    selectPagesDetailsState,
    (state: PagesDetailsState) => state.errorPageHighlights,
  );

  return {
    selectPagesDetailsState,
    selectPagesDetailsLoaded,
    selectPagesDetailsLoading,
    selectPagesDetailsError,
    selectPagesDetailsData,
    selectHashesLoaded,
    selectHashesLoading,
    selectHashesData,
    selectCurrentData,
    selectComparisonData,
    selectCurrentDateRangeLabel,
    selectComparisonDateRangeLabel,
    selectReadabilityData,
    selectPageLang,
    selectNumComments,
    selectNumCommentsPercentChange,
    selectFeedbackCommentsAndWords,
    selectVisitsByDay,
    selectVisitsByDaySeries,
    selectComparisonVisitsByDay,
    selectComparisonVisitsByDaySeries,
    selectChartType,
    selectCurrentVisitsByDayChartData,
    selectComparisonVisitsByDayChartData,
    selectVisitsByDayChartData,
    selectVisitsByDayChartTable,
    selectDyfNoPerVisitsSeries,
    selectAccessibilityData,
    selectAccessibilityLoaded,
    selectAccessibilityLoading,
    selectAccessibilityError,
    selectPageHighlightsKey,
    selectPageHighlights,
    selectPageHighlightsLoading,
    selectPageHighlightsError,
  };
}

const defaultPagesDetailsSelectors = createPagesDetailsSelectors(
  PAGES_DETAILS_FEATURE_KEY,
);

export const {
  selectPagesDetailsState,
  selectPagesDetailsLoaded,
  selectPagesDetailsLoading,
  selectPagesDetailsError,
  selectPagesDetailsData,
  selectHashesLoaded,
  selectHashesLoading,
  selectHashesData,
  selectCurrentData,
  selectComparisonData,
  selectCurrentDateRangeLabel,
  selectComparisonDateRangeLabel,
  selectReadabilityData,
  selectPageLang,
  selectNumComments,
  selectNumCommentsPercentChange,
  selectFeedbackCommentsAndWords,
  selectVisitsByDay,
  selectVisitsByDaySeries,
  selectComparisonVisitsByDay,
  selectComparisonVisitsByDaySeries,
  selectChartType,
  selectCurrentVisitsByDayChartData,
  selectComparisonVisitsByDayChartData,
  selectVisitsByDayChartData,
  selectVisitsByDayChartTable,
  selectDyfNoPerVisitsSeries,
  selectAccessibilityData,
  selectAccessibilityLoaded,
  selectAccessibilityLoading,
  selectAccessibilityError,
  selectPageHighlightsKey,
  selectPageHighlights,
  selectPageHighlightsLoading,
  selectPageHighlightsError,
} = defaultPagesDetailsSelectors;
