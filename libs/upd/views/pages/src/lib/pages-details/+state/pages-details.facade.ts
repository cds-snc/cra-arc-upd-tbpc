import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { map, debounceTime, combineLatest } from 'rxjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/en-ca';
import 'dayjs/locale/fr-ca';
import { type LocaleId } from '@dua-upd/upd/i18n';
import { I18nFacade, selectDatePeriodSelection, selectUrl } from '@dua-upd/upd/state';
import { percentChange } from '@dua-upd/utils-common';
import type { PickByType } from '@dua-upd/utils-common';
import type {
  GscSearchTermMetrics,
  PageAggregatedData,
  PageDetailsData,
} from '@dua-upd/types-common';
import * as PagesDetailsActions from './pages-details.actions';
import * as PagesDetailsSelectors from './pages-details.selectors';
import type {
  ApexAxisChartSeries,
} from 'ng-apexcharts';
import {
  selectPageLang,
  selectReadabilityData,
  selectVisitsByDayChartData,
  selectVisitsByDayChartTable,
  selectDyfNoPerVisitsSeries,
} from './pages-details.selectors';

dayjs.extend(utc);

@Injectable()
export class PagesDetailsFacade {
  private readonly store = inject(Store);
  private i18n = inject(I18nFacade);

  loaded$ = this.store.select(PagesDetailsSelectors.selectPagesDetailsLoaded);

  loading$ = this.store
    .select(PagesDetailsSelectors.selectPagesDetailsLoading)
    .pipe(debounceTime(500));

  loadedHashes$ = this.store.select(PagesDetailsSelectors.selectHashesLoaded);

  loadingHashes$ = this.store
    .select(PagesDetailsSelectors.selectHashesLoading)
    .pipe(debounceTime(500));

  pagesDetailsData$ = this.store.select(
    PagesDetailsSelectors.selectPagesDetailsData,
  );

  currentLang$ = this.i18n.currentLang$;

  currentRoute$ = this.store
      .select(selectUrl)
      .pipe(map((url) => url.replace(/\?.+$/, '')));

  dateRangeSelected$ = this.store.select(selectDatePeriodSelection);

  rawDateRange$ = combineLatest([this.pagesDetailsData$]).pipe(
    map(([data]) => {
      const dateRange = data.dateRange;
      if (dateRange) {
        const [startDate, endDate] = dateRange.split('/').map((d) => dayjs(d));

        return {
          start: startDate.startOf('day').toISOString().slice(0, -1),
          end: endDate.endOf('day').toISOString().slice(0, -1),
        };
      }
      return;
    }),
  );

  dateRangeLabel$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) => this.getDateRangeLabel(data.dateRange, lang) as string,
    ),
  );

  comparisonDateRangeLabel$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(data.comparisonDateRange || '', lang) as string,
    ),
  );

  fullDateRangeLabel$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(
          data.dateRange,
          lang,
          'MMM D YYYY',
          'to',
          true,
        ) as string[],
    ),
  );

  fullComparisonDateRangeLabel$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(
          data.comparisonDateRange || '',
          lang,
          'MMM D YYYY',
          'to',
          true,
        ) as string[],
    ),
  );

  apexBar$ = this.store.select(selectVisitsByDayChartData);

  pageTitle$ = this.pagesDetailsData$.pipe(map((data) => data?.title));
  pageUrl$ = this.pagesDetailsData$.pipe(map((data) => data?.url));
  
  altPageId$ = this.pagesDetailsData$.pipe(map((data) => data?.alternatePageId || 0));

  pageStatus$ = this.pagesDetailsData$.pipe(
    map((data) => {
      if (data?.isRedirect) {
        return 'Redirected';
      }

      if (data?.is404) {
        return '404';
      }

      return 'Live';
    }),
  );

  visitors$ = this.pagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.visitors || 0),
  );
  visitorsPercentChange$ = this.pagesDetailsData$.pipe(
    mapToPercentChange('visitors'),
  );

  visits$ = this.pagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.visits || 0),
  );
  visitsPercentChange$ = this.pagesDetailsData$.pipe(
    mapToPercentChange('visits'),
  );

  pageViews$ = this.pagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.views || 0),
  );
  pageViewsPercentChange$ = this.pagesDetailsData$.pipe(
    mapToPercentChange('views'),
  );

  impressions$ = this.pagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.gsc_total_impressions || 0),
  );
  impressionsPercentChange$ = this.pagesDetailsData$.pipe(
    mapToPercentChange('gsc_total_impressions'),
  );

  ctr$ = this.pagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.gsc_total_ctr || 0),
  );
  ctrPercentChange$ = this.pagesDetailsData$.pipe(
    mapToPercentChange('gsc_total_ctr'),
  );

  avgRank$ = this.pagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.gsc_total_position || 0),
  );
  avgRankPercentChange$ = this.pagesDetailsData$.pipe(
    mapToPercentChange('gsc_total_position'),
  );

  tasks$ = this.pagesDetailsData$.pipe(map((data) => data?.tasks || 0));

  readability$ = this.store.select(selectReadabilityData);

  apexKpiFeedback$ = this.store.select(selectDyfNoPerVisitsSeries);

  accessibility$ = this.store.select(PagesDetailsSelectors.selectAccessibilityData);
  accessibilityLoading$ = this.store.select(PagesDetailsSelectors.selectAccessibilityLoading).pipe(debounceTime(500));
  accessibilityLoaded$ = this.store.select(PagesDetailsSelectors.selectAccessibilityLoaded);
  accessibilityError$ = this.store.select(PagesDetailsSelectors.selectAccessibilityError);

  pageLang$ = this.store.select(selectPageLang);

  currentKpiFeedback$ = this.pagesDetailsData$.pipe(
    map((data) => {
      const dyfNoCurrent = data?.dateRangeData?.dyf_no || 0;
      const visits = data?.dateRangeData?.visits || 0;

      return dyfNoCurrent / visits;
    }),
  );

  comparisonKpiFeedback$ = combineLatest([this.pagesDetailsData$]).pipe(
    map(([data]) => {
      const dyfNoComparison = data?.comparisonDateRangeData?.dyf_no || 0;
      const visits = data?.comparisonDateRangeData?.visits || 0;

      return dyfNoComparison / visits;
    }),
  );

  kpiFeedbackPercentChange$ = combineLatest([
    this.currentKpiFeedback$,
    this.comparisonKpiFeedback$,
  ]).pipe(
    map(([currentKpi, comparisonKpi]) =>
      percentChange(currentKpi, comparisonKpi),
    ),
  );

  kpiFeedbackDifference$ = combineLatest([
    this.currentKpiFeedback$,
    this.comparisonKpiFeedback$,
  ]).pipe(map(([currentKpi, comparisonKpi]) => currentKpi - comparisonKpi));

  projects$ = combineLatest([this.pagesDetailsData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      return (
        data?.projects?.map((d) => ({
          id: d.id,
          title: this.i18n.service.translate(d.title, lang),
        })) || []
      );
    }),
  );

  activityMap$ = combineLatest([this.pagesDetailsData$]).pipe(
    map(([data]) => {
      return data?.activityMap || [];
    }),
  );

  visitsByDay$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
    this.dateRangeSelected$,
  ]).pipe(
    map(([data, lang, dateRangePeriod]) => {
      const visitsByDay = data?.dateRangeData?.visitsByDay;
      const comparisonVisitsByDay =
        data?.comparisonDateRangeData?.visitsByDay || [];
      const days = visitsByDay?.length || 0;
      const prevDays = comparisonVisitsByDay?.length || 0;
      const maxDays = Math.max(days, prevDays);
      const dateFormat = dateRangePeriod === 'week' ? 'dddd' : 'MMM D';
      let [startDate] = data.dateRange.split('/').map((d) => new Date(d));
      let [prevStartDate] = (data.comparisonDateRange || '')
        .split('/')
        .map((d) => new Date(d));

      if (!visitsByDay) {
        return [];
      }

      const isWeekly = dateRangePeriod === 'week';

      const isCurrZero = visitsByDay.every((v) => v.visits === 0);
      const isPrevZero = comparisonVisitsByDay.every((v) => v.visits === 0);

      if (isCurrZero && isPrevZero) {
        return [];
      }

      const dateRangeDates = visitsByDay.map(({ date }) => date);
      const dateRangeLabel = this.getDateRangeLabel(
        data.dateRange,
        lang,
        'MMM D',
      );

      const dateRangeSeries = visitsByDay.map(({ visits }) => ({
        name: dateRangeLabel, // todo: date label (x-axis) formatting based on date range length
        value: visits || 0,
      }));

      const comparisonDateRangeLabel = this.getDateRangeLabel(
        data.comparisonDateRange || '',
        lang,
        'MMM D',
      );

      const comparisonDateRangeSeries = comparisonVisitsByDay.map(
        ({ visits }) => ({
          name: comparisonDateRangeLabel,
          value: visits || 0,
        }),
      );

      if (!isWeekly) {
        let dayCount = 0;

        while (dayCount < maxDays) {
          const prevMonthDays = getMonthlyDays(prevStartDate);
          const currMonthDays = getMonthlyDays(startDate);

          if (currMonthDays > prevMonthDays) {
            // if the current month has more days than the previous month,
            // we need to pad the previous month with zeros

            const daysToPad = currMonthDays - prevMonthDays;
            comparisonDateRangeSeries.splice(
              dayCount + prevMonthDays,
              0,
              ...Array(daysToPad).fill({
                date: '*',
                visits: 0,
              }),
            );

            dayCount += currMonthDays;
          } else {
            // if the current month has less days than the previous month,
            // we need to pad the current month with zeros

            const daysToPad = prevMonthDays - currMonthDays;

            dateRangeSeries.splice(
              dayCount + currMonthDays,
              0,
              ...Array(daysToPad).fill({
                date: '*',
                visits: 0,
              }),
            );

            dayCount += prevMonthDays;
          }

          prevStartDate = dayjs(prevStartDate)
            .utc(false)
            .add(1, 'month')
            .toDate();
          startDate = dayjs(startDate).utc(false).add(1, 'month').toDate();
        }
      }

      let visitsByDayData = [];

      visitsByDayData = [
        {
          name: dateRangeLabel,
          series: dateRangeSeries.map(({ value }, i) => ({
            name: dayjs(dateRangeDates[i])
              .utc(false)
              .locale(lang)
              .format(dateFormat),
            value: value || 0,
          })),
        },
      ];

      if (
        data?.comparisonDateRangeData &&
        typeof data?.comparisonDateRange === 'string'
      ) {
        visitsByDayData.push({
          name: comparisonDateRangeLabel,
          series: comparisonDateRangeSeries.map(({ value }, i) => ({
            name: dayjs(dateRangeDates[i])
              .utc(false)
              .locale(lang)
              .format(dateFormat),
            value: value || 0,
          })),
        });
      }

      return visitsByDayData;
    }),
  );

  visitsByDeviceType$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dateRangeLabel = this.getDateRangeLabel(
        data.dateRange || '',
        lang,
        'MMM D',
      );
      const comparisonDateRangeLabel = this.getDateRangeLabel(
        data.comparisonDateRange || '',
        lang,
        'MMM D',
      );

      const dataByDeviceType = [
        {
          name: this.i18n.service.translate('Desktop', lang),
          value: data?.dateRangeData?.visits_device_desktop || 0,
        },
        {
          name: this.i18n.service.translate('Mobile', lang),
          value: data?.dateRangeData?.visits_device_mobile || 0,
        },
        {
          name: this.i18n.service.translate('Tablet', lang),
          value: data?.dateRangeData?.visits_device_tablet || 0,
        },
        {
          name: this.i18n.service.translate('Other', lang),
          value: data?.dateRangeData?.visits_device_other || 0,
        },
      ];

      const comparisonDataByDeviceType = [
        {
          name: this.i18n.service.translate('Desktop', lang),
          value: data?.comparisonDateRangeData?.visits_device_desktop || 0,
        },
        {
          name: this.i18n.service.translate('Mobile', lang),
          value: data?.comparisonDateRangeData?.visits_device_mobile || 0,
        },
        {
          name: this.i18n.service.translate('Tablet', lang),
          value: data?.comparisonDateRangeData?.visits_device_tablet || 0,
        },
        {
          name: this.i18n.service.translate('Other', lang),
          value: data?.comparisonDateRangeData?.visits_device_other || 0,
        },
      ];

      const isCurrZero = dataByDeviceType.every((v) => v.value === 0);
      const isPrevZero = comparisonDataByDeviceType.every((v) => v.value === 0);

      if (isCurrZero && isPrevZero) {
        return [];
      }

      const barChartData = [
        {
          name: dateRangeLabel,
          series: dataByDeviceType,
        },
        {
          name: comparisonDateRangeLabel,
          series: comparisonDataByDeviceType,
        },
      ];

      return barChartData;
    }),
  );

  barTable$ = this.store.select(selectVisitsByDayChartTable);

  visitsByDeviceTypeTable$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      return [
        {
          name: this.i18n.service.translate('Desktop', lang),
          currValue: data?.dateRangeData?.visits_device_desktop || 0,
          prevValue: data?.comparisonDateRangeData?.visits_device_desktop || 0,
        },
        {
          name: this.i18n.service.translate('Mobile', lang),
          currValue: data?.dateRangeData?.visits_device_mobile || 0,
          prevValue: data?.comparisonDateRangeData?.visits_device_mobile || 0,
        },
        {
          name: this.i18n.service.translate('Tablet', lang),
          currValue: data?.dateRangeData?.visits_device_tablet || 0,
          prevValue: data?.comparisonDateRangeData?.visits_device_tablet || 0,
        },
        {
          name: this.i18n.service.translate('Other', lang),
          currValue: data?.dateRangeData?.visits_device_other || 0,
          prevValue: data?.comparisonDateRangeData?.visits_device_other || 0,
        },
      ];
    }),
  );

  apexVisitsByDeviceTypeChart$ = combineLatest([
    this.visitsByDeviceTypeTable$,
  ]).pipe(
    map(([data]) => {
      return data.map(({ name, currValue, prevValue }) => ({
        name,
        data: [currValue, prevValue],
      }));
    }),
  );

  apexVisitsByDeviceTypeLabels$ = combineLatest([
    this.visitsByDeviceTypeTable$,
  ]).pipe(
    map(([data]) => {
      return data.map(({ name }) => name);
    }),
  );

  referrerTypePropToKeyMap = {
    visits_referrer_other: 'Other Web Sites',
    visits_referrer_searchengine: 'Search Engines',
    visits_referrer_typed_bookmarked: 'Typed/Bookmarked',
    visits_referrer_social: 'Social Networks',
  } as Record<keyof PageAggregatedData, string>;

  referrerType$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dataByReferrerType = Object.entries(
        this.referrerTypePropToKeyMap,
      ).map(([prop, refType]) => {
        const currentVal = (data?.dateRangeData?.[
          prop as keyof PageAggregatedData
        ] || 0) as number;
        const previousVal = (data?.comparisonDateRangeData?.[
          prop as keyof PageAggregatedData
        ] || 0) as number;

        const change =
          previousVal === 0
            ? currentVal === 0
              ? 0
              : Infinity
            : (currentVal - previousVal) / previousVal;

        return {
          type: this.i18n.service.translate(refType, lang),
          value: currentVal,
          change,
        };
      });

      const isZero = dataByReferrerType.every((v) => v.value === 0);

      if (isZero) {
        return [] as typeof dataByReferrerType;
      }

      return dataByReferrerType;
    }),
  );

  propToProvinceMap = {
    visits_geo_ab: 'Alberta',
    visits_geo_bc: 'British Columbia',
    visits_geo_mb: 'Manitoba',
    visits_geo_nb: 'New Brunswick',
    visits_geo_nl: 'Newfoundland and Labrador',
    visits_geo_ns: 'Nova Scotia',
    visits_geo_nt: 'Northwest Territories',
    visits_geo_nu: 'Nunavut',
    visits_geo_on: 'Ontario',
    visits_geo_pe: 'Prince Edward Island',
    visits_geo_qc: 'Quebec',
    visits_geo_sk: 'Saskatchewan',
    visits_geo_yt: 'Yukon',
    visits_geo_outside_canada: 'Outside Canada',
  } as Record<keyof PageAggregatedData, string>;

  visitorLocation$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dataByLocation = Object.entries(this.propToProvinceMap).map(
        ([prop, province]) => {
          const currentVal = (data?.dateRangeData?.[
            prop as keyof PageAggregatedData
          ] || 0) as number;
          const previousVal = (data?.comparisonDateRangeData?.[
            prop as keyof PageAggregatedData
          ] || 0) as number;

          const change =
            previousVal === 0 ? 0 : (currentVal - previousVal) / previousVal;

          return {
            province: this.i18n.service.translate(province, lang),
            value: currentVal,
            change,
          };
        },
      );

      const isZero = dataByLocation.every((v) => v.value === 0);

      if (isZero) {
        return [];
      }

      return dataByLocation;
    }),
  );

  // topPagesVisitedWithPercentChange$ = this.pagesDetailsData$.pipe(
  //   mapObjectArraysWithPercentChange('root', 'visits')
  // );

  dyfData$ = combineLatest([this.pagesDetailsData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      const yes = this.i18n.service.translate('yes', lang);
      const no = this.i18n.service.translate('no', lang);

      const currYesVal = data?.dateRangeData?.dyf_yes || 0;
      const prevYesVal = data?.comparisonDateRangeData?.dyf_yes || NaN;
      const currNoVal = data?.dateRangeData?.dyf_no || 0;
      const prevNoVal = data?.comparisonDateRangeData?.dyf_no || NaN;

      const pieChartData = [
        { name: yes, currValue: currYesVal, prevValue: prevYesVal },
        { name: no, currValue: currNoVal, prevValue: prevNoVal },
      ];

      const filteredPieChartData = pieChartData.filter(
        (v) => v.currValue > 0 || v.prevValue > 0,
      );

      return filteredPieChartData.length > 0 ? filteredPieChartData : [];
    }),
  );

  dyfDataApex$ = combineLatest([
    this.pagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dyfData: ApexAxisChartSeries = [
        {
          name: this.i18n.service.translate('yes', lang),
          data: [
            data?.dateRangeData?.dyf_yes || 0,
            data?.comparisonDateRangeData?.dyf_yes || 0,
          ],
        },
        {
          name: this.i18n.service.translate('no', lang),
          data: [
            data?.dateRangeData?.dyf_no || 0,
            data?.comparisonDateRangeData?.dyf_no || 0,
          ],
        },
      ];

      const isZero = dyfData.every((item) =>
        (item.data as number[]).every(
          (value) => typeof value === 'number' && value === 0,
        ),
      );

      if (isZero) {
        return [];
      }

      return dyfData;
    }),
  );

  topSearchTermsIncrease$ = this.pagesDetailsData$.pipe(
    map((data) => [...(data?.topSearchTermsIncrease || [])]),
  );

  topSearchTermsDecrease$ = this.pagesDetailsData$.pipe(
    map((data) => [...(data?.topSearchTermsDecrease || [])]),
  );

  top25GSCSearchTerms$ = this.pagesDetailsData$.pipe(
    map(
      (data) =>
        [...(data?.top25GSCSearchTerms || [])] as (GscSearchTermMetrics & {
          change: number;
        })[],
    ),
  );

  feedbackByDay$ = this.pagesDetailsData$.pipe(
    map((data) => {
      const feedbackByDayData = data?.feedbackByDay || [];

      return feedbackByDayData.every((v) => v.sum === 0)
        ? []
        : feedbackByDayData;
    }),
  );

  topSearchTerms$ = this.pagesDetailsData$.pipe(
    map((data) => data?.searchTerms),
  );

  feedbackMostRelevant = this.store.selectSignal(
    PagesDetailsSelectors.selectFeedbackMostRelevant,
  );
  numComments = this.store.selectSignal(
    PagesDetailsSelectors.selectNumComments,
  );
  numCommentsPercentChange = this.store.selectSignal(
    PagesDetailsSelectors.selectNumCommentsPercentChange,
  );

  getDateRangeLabel(
    dateRange: string,
    lang: LocaleId,
    dateFormat = 'MMM D YYYY',
    separator = '-',
    breakLine = false,
  ) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    dateFormat = this.i18n.service.translate(dateFormat, lang);
    separator = this.i18n.service.translate(separator, lang);

    const formattedStartDate = dayjs
      .utc(startDate)
      .locale(lang)
      .format(dateFormat);
    const formattedEndDate = dayjs.utc(endDate).locale(lang).format(dateFormat);

    //breakLine exists for apexcharts labels
    return breakLine
      ? [`${formattedStartDate} ${separator}`, `${formattedEndDate}`]
      : `${formattedStartDate} ${separator} ${formattedEndDate}`;
  }

  error$ = this.store.select(PagesDetailsSelectors.selectPagesDetailsError);

  hashesData = this.store.selectSignal(
    PagesDetailsSelectors.selectHashesData
  );

  getHashes() {
    this.store.dispatch(PagesDetailsActions.getHashes());
  }

  /**
   * Use the initialization action to perform one
   * or more tasks in your Effects.
   */
  init() {
    this.store.dispatch(PagesDetailsActions.loadPagesDetailsInit());
  }

  refreshAccessibilityTest(url: string) {
    this.store.dispatch(PagesDetailsActions.loadAccessibilityInit({ url }));
  }
}

const getMonthlyDays = (date: Date) => {
  return dayjs(date).utc(false).daysInMonth();
};

type DateRangeDataIndexKey = keyof PageAggregatedData &
  keyof PickByType<PageAggregatedData, number>;

// helper function to get the percent change of a property vs. the comparison date range
function mapToPercentChange(
  propName: keyof PickByType<PageAggregatedData, number>,
) {
  return map((data: PageDetailsData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return 0;
    }

    const current = data?.dateRangeData[propName as DateRangeDataIndexKey];
    const previous =
      data?.comparisonDateRangeData[propName as DateRangeDataIndexKey];

    if (!current || !previous) {
      return 0;
    }

    return percentChange(current, previous);
  });
}

function mapObjectArraysWithPercentChange(
  propName: keyof PageAggregatedData,
  propPath: string,
) {
  return map((data: PageDetailsData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return;
    }

    const current = data?.dateRangeData[propName];
    const previous = data?.comparisonDateRangeData[propName];

    if (!current || !previous) {
      return;
    }

    const propsAreValidArrays =
      Array.isArray(current) &&
      Array.isArray(previous) &&
      current.length > 0 &&
      previous.length > 0 &&
      current.length === previous.length;

    if (propsAreValidArrays) {
      return current.map((val: any, i) => ({
        ...val,
        percentChange: percentChange(
          val[propPath],
          (previous as any)[i][propPath],
        ),
      }));
    }

    throw Error('Invalid data arrays in mapObjectArraysWithPercentChange');
  });
}
