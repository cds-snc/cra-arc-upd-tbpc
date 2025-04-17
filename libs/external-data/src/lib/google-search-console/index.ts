import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { GaxiosPromise, searchconsole_v1 } from '@googleapis/searchconsole';
import { getGscClient, Searchconsole } from './client';
import {
  SearchAnalyticsQueryBuilder,
  SearchAnalyticsReportQuery,
  SearchFilter,
} from './query';
import { DataState, Dimension } from './gsc-property';
import type { DateRange, GscSearchTermMetrics, IOverall, IPageMetrics } from '@dua-upd/types-common';
import { wait } from '@dua-upd/utils-common';
import { singleDatesFromDateRange, withExponentialBackoff, withRetry } from '../utils';

export * from './client';
export * from './query';

dayjs.extend(utc);

export const craFilter: SearchFilter = {
  dimension: 'page',
  operator: 'includingRegex',
  expression:
    'www.canada.ca/en/revenue-agency' +
    '|www.canada.ca/fr/agence-revenu' +
    '|www.canada.ca/en/services/taxes' +
    '|www.canada.ca/fr/services/impots',
};

export const createRegexFilter = (expression: string): SearchFilter => ({
  dimension: 'page',
  operator: 'includingRegex',
  expression,
});

export interface SearchAnalyticsQueryOptions {
  dataState?: DataState;
  rowLimit?: number;
}

export interface SearchAnalyticsPageQueryOptions
  extends SearchAnalyticsQueryOptions {
  url?: string;
  regex?: string;
}

export type SearchAnalyticsResponse =
  searchconsole_v1.Schema$SearchAnalyticsQueryResponse;

export class SearchAnalyticsClient {
  private client: Searchconsole = getGscClient();

  async query(query: SearchAnalyticsReportQuery): GaxiosPromise<searchconsole_v1.Schema$SearchAnalyticsQueryResponse> {
    const queryWithRetry = withRetry(
      this.client.searchanalytics.query.bind(this.client.searchanalytics),
      3,
      500
    );

    return queryWithRetry(query);
  }

  async queryWithExponentialBackoff(query: SearchAnalyticsReportQuery): GaxiosPromise<searchconsole_v1.Schema$SearchAnalyticsQueryResponse> {
    const queryWithExponentialBackoff = withExponentialBackoff(
      this.client.searchanalytics.query.bind(this.client.searchanalytics),
      5,
      1000
    );

    return queryWithExponentialBackoff(query);
  }

  async getOverallMetrics(dateRange: DateRange<string> | Date, dataState?: DataState) {
    const dates =
      dateRange instanceof Date
        ? [dayjs.utc(dateRange).format('YYYY-MM-DD')]
        : (singleDatesFromDateRange(dateRange) as string[]);

    const promises = [];

    for (const date of dates) {
      const mergedDateResults = Promise.all([
        this.getOverallTotals(date, { dataState }),
        this.getOverallSearchTerms(date, { rowLimit: 15000, dataState }),
      ]).then(([totals, searchTerms]) => ({
        ...totals,
        ...searchTerms,
      }));

      await wait(500);

      promises.push(mergedDateResults);
    }

    return await Promise.all<IOverall[]>(promises);
  }

  async getOverallTotals(
    date: string,
    options?: SearchAnalyticsQueryOptions
  ): Promise<Partial<IOverall>> {
    const queryBuilder = new SearchAnalyticsQueryBuilder();

    const query = queryBuilder
      .setStartDate(date)
      .setEndDate(date)
      .setFilters([craFilter])
      .setDataState(options?.dataState || 'final')
      .setRowLimit(options?.rowLimit || 1)
      .build();

    const results = await this.query(query);

    if (!results.data.rows || results.data.rows?.length === 0) {
      return {};
    }

    return results.data.rows.map(
      (row) =>
        ({
          date: dayjs.utc(date).toDate(),
          gsc_total_clicks: row.clicks,
          gsc_total_impressions: row.impressions,
          gsc_total_ctr: row.ctr,
          gsc_total_position: row.position,
        } as Partial<IOverall>)
    )[0];
  }

  async getOverallSearchTerms(
    date: string,
    options?: SearchAnalyticsQueryOptions
  ): Promise<Partial<IOverall>> {
    const queryBuilder = new SearchAnalyticsQueryBuilder();

    const query = queryBuilder
      .setStartDate(date)
      .setEndDate(date)
      .addDimensions(['query'])
      .setFilters([craFilter])
      .setDataState(options?.dataState || 'final')
      .setRowLimit(options?.rowLimit || 250)
      .build();

    const results = await this.queryWithExponentialBackoff(query);

    if (!results.data.rows || results.data.rows?.length === 0) {
      return {};
    }

    const gsc_searchterms: GscSearchTermMetrics[] = results.data.rows.map(
      (row) => ({
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        term: row.keys[0],
      })
    );

    return {
      date: dayjs.utc(date).toDate(),
      gsc_searchterms,
    };
  }

  async getPageMetrics(
    dateRange: DateRange<string> | Date,
    options?: SearchAnalyticsPageQueryOptions & {
      onComplete?: (data: Partial<IPageMetrics>[]) => Promise<void>;
    }
  ) {
    const dates =
      dateRange instanceof Date
        ? [dayjs.utc(dateRange).format('YYYY-MM-DD')]
        : (singleDatesFromDateRange(dateRange, 'YYYY-MM-DD', true) as string[]);
    console.log('GSC getPageMetrics dates:', dates);
    const promises: Promise<Partial<IPageMetrics>[]>[] = [];

    for (const date of dates) {
      const mergedDateResults = Promise.all([
        this.getPageTotals(date, options),
        this.getPageSearchTerms(date, options),
      ]).then(([totals, searchTerms]) => {
        const resultsWithTotals = Object.values(totals).map((total) => ({
          ...total,
          ...(searchTerms[total.url] || {}),
        }));

        const pagesWithTotals = Object.keys(totals);

        const pagesWithoutTotals = Object.keys(searchTerms).filter(
          (url) => !pagesWithTotals.includes(url)
        );

        // Some pages don't seem to have totals, so we'll just sum the search term metrics
        const resultsWithoutTotals = pagesWithoutTotals.map((url) => {
          const pageResults = searchTerms[url];

          const totals = pageResults.gsc_searchterms.reduce(
            (results, searchTerm) => {
              results.gsc_total_clicks += searchTerm.clicks;
              results.gsc_total_impressions += searchTerm.impressions;
              results.gsc_total_ctr += searchTerm.ctr;
              results.gsc_total_position += searchTerm.position;
              return results;
            },
            {
              gsc_total_clicks: 0,
              gsc_total_impressions: 0,
              gsc_total_ctr: 0,
              gsc_total_position: 0,
            }
          );

          return {
            ...pageResults,
            ...totals,
          } as Partial<IPageMetrics>;
        });

        return [...resultsWithTotals, ...resultsWithoutTotals];
      });

      await wait(500);

      const promise = options?.onComplete
        ? mergedDateResults.then(async (data) => {
            await options.onComplete(data);

            return data;
          })
        : mergedDateResults;

      promises.push(promise);
    }

    return await Promise.all(promises);
  }

  async getPageTotals(
    date: string,
    options?: SearchAnalyticsPageQueryOptions
  ): Promise<Record<string, Partial<IPageMetrics>>> {
    const queryBuilder = new SearchAnalyticsQueryBuilder();

    const pageFilter: SearchFilter =
      !options?.url && !options?.regex
        ? craFilter
        : options?.regex
        ? createRegexFilter(options.regex)
        : {
            dimension: 'page',
            expression: `https://${options.url}`,
          };

    const dimensions: Dimension[] = ['page'];

    const pageMetricsQuery = queryBuilder
      .setStartDate(date)
      .setEndDate(date)
      .addDimensions(dimensions)
      .setFilters([pageFilter]) // split into en/fr, experiment with regex to find ways to optimize
      .setDataState(options?.dataState || 'final')
      .setRowLimit(options?.rowLimit || 25000)
      .build();

    const results = await this.queryWithExponentialBackoff(pageMetricsQuery);

    if (!results.data.rows || results.data.rows?.length === 0) {
      return {};
    }

    return results.data.rows
      .map(
        (row) =>
          ({
            date: dayjs.utc(date).toDate(),
            url: row['keys'][0].replace('https://', '').replace('#.+', ''),
            gsc_total_clicks: row.clicks,
            gsc_total_impressions: row.impressions,
            gsc_total_ctr: row.ctr,
            gsc_total_position: row.position,
          } as Partial<IPageMetrics>)
      )
      .reduce((results, pageMetrics) => {
        results[pageMetrics.url] = pageMetrics;

        return results;
      }, {} as Record<string, Partial<IPageMetrics>>);
  }

  async getPageSearchTerms(
    date: string,
    options?: SearchAnalyticsPageQueryOptions
  ): Promise<Record<string, Partial<IPageMetrics>>> {
    const queryBuilder = new SearchAnalyticsQueryBuilder();

    const pageFilter: SearchFilter =
      !options?.url && !options?.regex
        ? craFilter
        : options?.regex
        ? createRegexFilter(options.regex)
        : {
            dimension: 'page',
            expression: `https://${options.url}`,
          };

    const dimensions: Dimension[] = ['page', 'query'];

    const query = queryBuilder
      .setStartDate(date)
      .setEndDate(date)
      .addDimensions(dimensions)
      .setFilters([pageFilter])
      .setDataState(options?.dataState || 'final')
      .setRowLimit(options?.rowLimit || 25000)
      .build();

    const results = await this.queryWithExponentialBackoff(query);

    if (!results.data.rows || results.data.rows?.length === 0) {
      return {};
    }

    return results.data.rows.reduce((results, row) => {
      const url = row.keys?.[0]?.replace('https://', '').replace('#.+', '') || '';

      if (!results[url]) {
        results[url] = {
          date: dayjs.utc(date).toDate(),
          url,
          gsc_searchterms: [],
        };
      }

      if ((results[url].gsc_searchterms?.length || 0) >= 250) {
        return results;
      }

      results[url].gsc_searchterms?.push({
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
        term: row.keys?.[1] || '',
      });

      return results;
    }, {} as Record<string, Partial<IPageMetrics>>);
  }
}
