import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, debounceTime, map } from 'rxjs';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import 'dayjs/locale/en-ca';
import 'dayjs/locale/fr-ca';

import { type LocaleId } from '@dua-upd/upd/i18n';
import {
  I18nFacade,
  selectDatePeriodSelection,
  selectUrl,
} from '@dua-upd/upd/state';
import { percentChange } from '@dua-upd/utils-common';
import type { PickByType } from '@dua-upd/utils-common';
import type {
  PortalPageAggregatedData,
  PortalPageDetailsData,
} from '@dua-upd/types-common';

import * as PortalPagesDetailsActions from './portal-pages-details.actions';
import * as PortalPagesDetailsSelectors from './portal-pages-details.selectors';
import { selectPageLang } from './portal-pages-details.selectors';

dayjs.extend(utc);

@Injectable()
export class PortalPagesDetailsFacade {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nFacade);

  loaded$ = this.store.select(
    PortalPagesDetailsSelectors.selectPortalPagesDetailsLoaded,
  );

  loading$ = this.store
    .select(PortalPagesDetailsSelectors.selectPortalPagesDetailsLoading)
    .pipe(debounceTime(500));

  portalPagesDetailsData$ = this.store.select(
    PortalPagesDetailsSelectors.selectPortalPagesDetailsData,
  );

  error$ = this.store.select(
    PortalPagesDetailsSelectors.selectPortalPagesDetailsError,
  );

  apexBar$ = this.store.select(
    PortalPagesDetailsSelectors.selectVisitsByDayChartData,
  );

  barTable$ = this.store.select(
    PortalPagesDetailsSelectors.selectVisitsByDayChartTable,
  );

  currentLang$ = this.i18n.currentLang$;

  currentRoute$ = this.store
    .select(selectUrl)
    .pipe(map((url) => url.replace(/\?.+$/, '')));

  dateRangeSelected$ = this.store.select(selectDatePeriodSelection);

  pageLang$ = this.store.select(selectPageLang);

  /*
   * Page metadata
   */

  pageTitle$ = this.portalPagesDetailsData$.pipe(map((data) => data?.title));

  pageUrl$ = this.portalPagesDetailsData$.pipe(map((data) => data?.url));

  rawDateRange$ = this.portalPagesDetailsData$.pipe(
    map((data) => {
      const dateRange = data?.dateRange;

      if (!dateRange) {
        return;
      }

      const [startDate, endDate] = dateRange
        .split('/')
        .map((date) => dayjs(date));

      return {
        start: startDate.startOf('day').toISOString().slice(0, -1),
        end: endDate.endOf('day').toISOString().slice(0, -1),
      };
    }),
  );

  dateRangeLabel$ = combineLatest([
    this.portalPagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) => this.getDateRangeLabel(data.dateRange, lang) as string,
    ),
  );

  comparisonDateRangeLabel$ = combineLatest([
    this.portalPagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(data.comparisonDateRange || '', lang) as string,
    ),
  );

  /*
   * Main metrics
   */

  visitors$ = this.portalPagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.visitors || 0),
  );

  visitorsPercentChange$ = this.portalPagesDetailsData$.pipe(
    mapToPercentChange('visitors'),
  );

  visits$ = this.portalPagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.visits || 0),
  );

  visitsPercentChange$ = this.portalPagesDetailsData$.pipe(
    mapToPercentChange('visits'),
  );

  pageViews$ = this.portalPagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.views || 0),
  );

  pageViewsPercentChange$ = this.portalPagesDetailsData$.pipe(
    mapToPercentChange('views'),
  );

  averageTimeSpent$ = this.portalPagesDetailsData$.pipe(
    map((data) => data?.dateRangeData?.average_time_spent || 0),
  );

  averageTimeSpentPercentChange$ = this.portalPagesDetailsData$.pipe(
    mapToPercentChange('average_time_spent'),
  );

  /*
   * Device breakdown
   */

  visitsByDeviceTypeTable$ = combineLatest([
    this.portalPagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => [
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
    ]),
  );

  apexVisitsByDeviceTypeChart$ = this.visitsByDeviceTypeTable$.pipe(
    map((data) =>
      data.map(({ name, currValue, prevValue }) => ({
        name,
        data: [currValue, prevValue],
      })),
    ),
  );

  /*
   * Location breakdown
   */

  private readonly locationProperties = {
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
    visits_geo_us: 'United States',
    visits_geo_outside_canada: 'Outside Canada',
  } as const;

  visitorLocation$ = combineLatest([
    this.portalPagesDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      return Object.entries(this.locationProperties)
        .map(([property, location]) => {
          const key = property as keyof PortalPageAggregatedData;

          const currentValue = (data?.dateRangeData?.[key] as number) || 0;

          const prevValue =
            (data?.comparisonDateRangeData?.[key] as number) || 0;

          return {
            location: this.i18n.service.translate(location, lang),
            currentValue,
            prevValue,
            change:
              prevValue === 0 ? 0 : percentChange(currentValue, prevValue),
          };
        })
        .filter(
          ({ currentValue, prevValue }) => currentValue > 0 || prevValue > 0,
        );
    }),
  );

  /*
   * Date helper
   */

  getDateRangeLabel(
    dateRange: string,
    lang: LocaleId,
    dateFormat = 'MMM D YYYY',
    separator = '-',
    breakLine = false,
  ) {
    if (!dateRange) {
      return breakLine ? ['', ''] : '';
    }

    const [startDate, endDate] = dateRange
      .split('/')
      .map((date) => new Date(date));

    dateFormat = this.i18n.service.translate(dateFormat, lang);
    separator = this.i18n.service.translate(separator, lang);

    const formattedStartDate = dayjs
      .utc(startDate)
      .locale(lang)
      .format(dateFormat);

    const formattedEndDate = dayjs.utc(endDate).locale(lang).format(dateFormat);

    return breakLine
      ? [`${formattedStartDate} ${separator}`, `${formattedEndDate}`]
      : `${formattedStartDate} ${separator} ${formattedEndDate}`;
  }

  init() {
    this.store.dispatch(PortalPagesDetailsActions.loadPortalPagesDetailsInit());
  }
}

type DateRangeDataIndexKey = keyof PortalPageAggregatedData &
  keyof PickByType<PortalPageAggregatedData, number>;

function mapToPercentChange(
  propName: keyof PickByType<PortalPageAggregatedData, number>,
) {
  return map((data: PortalPageDetailsData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return 0;
    }

    const current = data.dateRangeData[propName as DateRangeDataIndexKey];

    const previous =
      data.comparisonDateRangeData[propName as DateRangeDataIndexKey];

    if (typeof current !== 'number' || typeof previous !== 'number') {
      return 0;
    }

    // A percentage change from a zero baseline isn't meaningful.
    if (previous === 0) {
      return 0;
    }

    return percentChange(current, previous);
  });
}
