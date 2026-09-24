import { createFeatureSelector, createSelector } from '@ngrx/store';
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
import {
  PORTAL_PAGES_DETAILS_FEATURE_KEY,
  PortalPagesDetailsState,
} from './portal-pages-details.reducer';

export const selectPortalPagesDetailsState =
  createFeatureSelector<PortalPagesDetailsState>(
    PORTAL_PAGES_DETAILS_FEATURE_KEY,
  );

export const selectPortalPagesDetailsLoaded = createSelector(
  selectPortalPagesDetailsState,
  (state: PortalPagesDetailsState) => state.loaded,
);

export const selectPortalPagesDetailsLoading = createSelector(
  selectPortalPagesDetailsState,
  (state: PortalPagesDetailsState) => state.loading,
);

export const selectPortalPagesDetailsError = createSelector(
  selectPortalPagesDetailsState,
  (state: PortalPagesDetailsState) => state.error,
);

export const selectPortalPagesDetailsData = createSelector(
  selectPortalPagesDetailsState,
  (state: PortalPagesDetailsState) => state.data,
);

export const selectHashesLoaded = createSelector(
  selectPortalPagesDetailsState,
  (state: PortalPagesDetailsState) => state.loadedHashes,
);

export const selectHashesLoading = createSelector(
  selectPortalPagesDetailsState,
  (state: PortalPagesDetailsState) => state.loadingHashes,
);

export const selectCurrentData = createSelector(
  selectPortalPagesDetailsData,
  ({ dateRangeData }) => dateRangeData,
);

export const selectComparisonData = createSelector(
  selectPortalPagesDetailsData,
  ({ comparisonDateRangeData }) => comparisonDateRangeData,
);

export const selectCurrentDateRangeLabel =
  selectDateRangeLabel(selectDateRange);

export const selectComparisonDateRangeLabel = selectDateRangeLabel(
  selectComparisonDateRange,
);

export const selectPageLang = createSelector(
  selectPortalPagesDetailsData,
  ({ url }) => (url ? /canada\.ca\/(en|fr)/i.exec(url)?.[1] : null) || null,
);

export const selectVisitsByDay = createSelector(
  selectCurrentData,
  (data) => data?.visitsByDay || [],
);

export const selectVisitsByDaySeries = createSelector(
  selectVisitsByDay,
  (visitsByDay) =>
    visitsByDay.map(({ date, visits }) => ({
      x: date,
      y: visits,
    })),
);

export const selectComparisonVisitsByDay = createSelector(
  selectComparisonData,
  (data) => data?.visitsByDay || [],
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
      })),
);

export const selectChartType = createSelector(
  selectDatePeriodSelection,
  (dateRangePeriod) =>
    (['week', 'month'] as DateRangeType[]).includes(dateRangePeriod)
      ? 'column'
      : 'line',
);

export const selectCurrentVisitsByDayChartData = createSelector(
  selectCurrentDateRangeLabel,
  selectVisitsByDaySeries,
  selectChartType,
  (label, visits, chartType) => ({
    name: label,
    data: visits,
    type: chartType,
  }),
);

export const selectComparisonVisitsByDayChartData = createSelector(
  selectComparisonDateRangeLabel,
  selectComparisonVisitsByDaySeries,
  selectChartType,
  (label, visits, chartType) => ({
    name: label,
    data: visits,
    type: chartType,
  }),
);

export const selectVisitsByDayChartData = createSelector(
  selectCurrentVisitsByDayChartData,
  selectComparisonVisitsByDayChartData,
  (data, prevData) => [data, prevData],
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
  },
);
