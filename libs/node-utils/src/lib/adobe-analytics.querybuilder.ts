import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { clone, logJson } from '@dua-upd/utils-common';
import type {
  AADimensionId,
  AAMetricId,
  CalculatedMetricId,
  MetricsConfig,
  ReportFilter,
  ReportSearch,
  ReportSettings,
  ReportStatistics,
} from '@dua-upd/types-common';
import type {
  AdobeAnalyticsReportQuery,
  ReportRow,
} from './adobe-analytics.types';

dayjs.extend(utc);

export class AdobeAnalyticsQueryBuilder {
  private readonly query: AdobeAnalyticsReportQuery;

  constructor(rsid: string = process.env.AW_REPORTSUITE_ID || '') {
    this.query = {
      rsid,
      dimension: 'variables/evar22',
      metricContainer: {
        metrics: [],
      },
    };
  }

  clone() {
    return clone<AdobeAnalyticsQueryBuilder>(this);
  }

  public setDimension(dimension: AADimensionId) {
    this.query.dimension = dimension;
    return this;
  }

  public setMetrics(metrics: MetricsConfig) {
    const multiFilter = Object.keys(metrics).length !== 1;

    for (const [key, metric] of Object.entries(metrics)) {
      if (typeof metric === 'string') {
        this.query.metricContainer.metrics.push({
          id: metric,
          columnId: key,
        });

        continue;
      }

      if (!this.query.metricContainer.metricFilters) {
        this.query.metricContainer.metricFilters = [];
      }

      if (metric.filters?.[0]?.itemIds?.length) {
        const idPrefix = multiFilter ? `${key}-` : '';

        for (const filter of metric.filters) {
          for (const itemId of filter.itemIds || []) {
            this.query.metricContainer.metrics.push({
              id: metric.id,
              columnId: `${idPrefix}${itemId}`,
              filters: [`${idPrefix}${itemId}`],
            });

            this.query.metricContainer.metricFilters.push({
              id: `${idPrefix}${itemId}`,
              type: filter.type,
              dimension: filter.dimension,
              itemId,
            });
          }
        }

        continue;
      }

      // if no itemIds, ignore filters? Probably going to need to change this (this is mostly for overall metrics)
      this.query.metricContainer.metrics.push({
        id: metric.id,
        columnId: key,
      });
    }

    return this;
  }

  public addMetric(
    metricId: AAMetricId | CalculatedMetricId,
    columnId: string,
    filters?: string[],
  ) {
    const metric = {
      id: metricId,
      columnId,
      filters,
    };

    this.query.metricContainer.metrics.push(metric);

    return this;
  }

  public addMetricFilter(filter: ReportFilter) {
    this.query.metricContainer.metricFilters =
      this.query.metricContainer.metricFilters || [];
    this.query.metricContainer.metricFilters.push(filter);

    return this;
  }

  public setMetricFilters(filters: ReportFilter[]) {
    this.query.metricContainer.metricFilters = filters;

    return this;
  }

  public setRowFilters(filters: ReportFilter[]) {
    if (!this.query.rowContainer) {
      this.query.rowContainer = {
        rowFilters: [],
        rows: [],
      };
    }

    if (!this.query.rowContainer.rowFilters) {
      this.query.rowContainer.rowFilters = [];
    }

    this.query.rowContainer.rowFilters = filters;

    return this;
  }

  public setRows(rows: ReportRow[]) {
    if (!this.query.rowContainer) {
      this.query.rowContainer = {
        rowFilters: [],
        rows: rows,
      };
    }

    return this;
  }

  public addGlobalFilters(filters: ReportFilter[]) {
    this.query.globalFilters = [
      ...(this.query.globalFilters || []),
      ...filters,
    ];

    return this;
  }

  public prependGlobalFilters(filters: ReportFilter[]) {
    this.query.globalFilters = [
      ...filters,
      ...(this.query.globalFilters || []),
    ];

    return this;
  }
  public setGlobalFilters(filters: ReportFilter[]) {
    this.query.globalFilters = filters;

    return this;
  }

  public setSearch(search: ReportSearch) {
    this.query.search = search;

    return this;
  }

  public setSettings(settings: ReportSettings) {
    this.query.settings = {
      ...this.query.settings,
      ...settings,
    };

    return this;
  }

  public setStatistics(statistics: ReportStatistics) {
    this.query.statistics = statistics;

    return this;
  }

  public setAnchorDate(date: string) {
    this.query.anchorDate = date;
  }

  public build(logOutput = false): AdobeAnalyticsReportQuery {
    if (this.query.metricContainer.metrics.length === 0) {
      throw new Error(
        'Tried to build a query with no metrics, a query must have at least one metric',
      );
    }

    logOutput && logJson(this.query);

    return this.query;
  }
}

/** Adobe Analytics Query Date Format */
export const queryDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSS';
