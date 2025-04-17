import { mongo, Types, UpdateQuery } from 'mongoose';
import { keys, union } from 'rambdax';
import { CustomReportsMetrics, DbService } from '@dua-upd/db';
import { queryDateFormat } from '@dua-upd/node-utils';
import type { AAResponseBody } from '@dua-upd/node-utils';
import type {
  AADimensionName,
  AAMetricName,
  AAQueryConfig,
  AAQueryDateRange,
  DimensionMetrics,
  ReportConfig,
} from '@dua-upd/types-common';
import {
  arrayToDictionary,
  chunkMap,
  dateRangeToGranularity,
} from '@dua-upd/utils-common';
import type { ReportDataPoint } from './custom-reports.service';

// todo: refactor all the strategy stuff...

/**
 * Derive the individual data points to be inserted from query results into the database.
 * To be used for identifying data points, for checking whether they already exist
 * in the db or will be processed by a currently running job.
 *
 * @param reportConfig The report config.
 * @param queryConfig The query config.
 */
export function deriveDataPoints(
  reportConfig: ReportConfig<Date>,
  queryConfig: AAQueryConfig,
): ReportDataPoint[] {
  const { grouped, granularity, breakdownDimension } = reportConfig;
  const { urls: _urls, metricNames, dateRange } = queryConfig;

  const urls = Array.isArray(_urls) ? _urls : [_urls];
  const metrics = Array.isArray(metricNames) ? metricNames : [metricNames];
  const dimension = breakdownDimension
    ? { breakdownDimension: breakdownDimension as AADimensionName }
    : {};

  const commonOutput = {
    startDate: new Date(dateRange.start + 'Z'),
    endDate: new Date(dateRange.end + 'Z'),
    granularity,
    grouped,
    ...dimension,
  };

  if (grouped) {
    return [
      {
        ...commonOutput,
        urls,
        metrics,
      },
    ];
  }

  return urls.map((url) => ({
    ...commonOutput,
    url,
    metrics,
  }));
}

/**
 * Decompose the report config into a list queries for granular data, along with
 * a list of the individual data points to be inserted (to be used for tracking/reuse).
 * @param config The report config.
 */
export function decomposeConfig(config: ReportConfig<Date>) {
  const {
    dateRange,
    granularity,
    urls,
    metrics: metricNames,
    grouped,
    breakdownDimension,
  } = config;

  const dateRanges = (
    granularity === 'none'
      ? [
          {
            start: dateRange.start.toISOString().slice(0, -1),
            end: dateRange.end.toISOString().slice(0, -1),
          },
        ]
      : dateRangeToGranularity(dateRange, granularity, queryDateFormat)
  ) as AAQueryDateRange[];

  const dimensionName: AADimensionName =
    breakdownDimension || (grouped ? 'none' : 'url_last_255');

  const toQueryConfig = (dateRange: AAQueryDateRange, urls: string[]) =>
    ({
      dateRange,
      metricNames,
      dimensionName,
      urls,
    }) as AAQueryConfig;

  const chunkedUrls = chunkMap(urls, (url) => url, 50);

  const queries = dateRanges.flatMap((dateRange) =>
    grouped
      ? [toQueryConfig(dateRange, urls)]
      : breakdownDimension
        ? urls.map((url) => toQueryConfig(dateRange, [url]))
        : chunkedUrls.map((url) => toQueryConfig(dateRange, url)),
  );

  return queries.map((query) => ({
    query,
    dataPoints: deriveDataPoints(config, query),
  }));
}

export function dataPointToBulkInsert(
  dataPoint: ReportDataPoint,
  metrics: mongo.MatchKeysAndValues<CustomReportsMetrics>,
) {
  const { startDate, endDate, url, urls, grouped, granularity } = dataPoint;

  if (grouped && !urls?.length) {
    throw new Error('No urls found for grouped data point');
  }

  const dates =
    granularity === 'day'
      ? {
          startDate: new Date(startDate),
        }
      : {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        };

  const datesGroupedGranularity = {
    ...dates,
    grouped,
    granularity,
  };

  const filter = grouped
    ? {
        urls: {
          $all: urls?.map((url) => ({ $elemMatch: { $eq: url } })),
          $size: urls?.length,
        },
        ...datesGroupedGranularity,
      }
    : {
        url,
        ...datesGroupedGranularity,
      };

  const _urls = grouped
    ? {
        urls,
      }
    : { url };

  return {
    updateOne: {
      filter,
      update: {
        $setOnInsert: {
          _id: new Types.ObjectId(),
          ..._urls,
          ...datesGroupedGranularity,
        },
        $set: {
          ...metrics,
        },
      },
      upsert: true,
    },
  } satisfies mongo.AnyBulkWriteOperation<CustomReportsMetrics>;
}

export function getStrategy(config: ReportConfig<unknown>) {
  const { grouped, breakdownDimension } = config;

  if (breakdownDimension) {
    return withDimensionStrategy;
  }

  if (grouped) {
    return groupedNoDimensionStrategy;
  }

  if (!grouped) {
    return ungroupedNoDimensionStrategy;
  }

  throw new Error('Results processor not found');
}

export function processResults(
  config: ReportConfig<unknown>,
  query: AAQueryConfig,
  dataPoints: ReportDataPoint[],
  results: AAResponseBody,
) {
  return getStrategy(config).toDbUpdates(dataPoints, query, results);
}

export interface QueryResultsProcessor<ParsedData> {
  parseQueryResults(query: AAQueryConfig, results: AAResponseBody): ParsedData;
  dataPointToMetrics(
    dataPoint: ReportDataPoint,
    parsedData: ParsedData,
  ): mongo.MatchKeysAndValues<CustomReportsMetrics>;
}

export interface NoDimensionQueryResultsProcessor<ParsedData>
  extends QueryResultsProcessor<ParsedData> {
  toDbUpdates(
    dataPoints: ReportDataPoint[],
    query: AAQueryConfig,
    queryResults: AAResponseBody,
  ): mongo.AnyBulkWriteOperation<CustomReportsMetrics>[];
}

export type DimensionQueryResultsProcessor<ParsedData> =
  QueryResultsProcessor<ParsedData> & {
    /*
     * instead of returning a list of bulk write operations, return a function
     * that just needs to be passed an instance of the db service, and will perform
     * all the updates itself
     */
    toDbUpdates(
      dataPoints: ReportDataPoint[],
      query: AAQueryConfig,
      queryResults: AAResponseBody,
    ): (db: DbService) => Promise<void>;
  };

export const ungroupedNoDimensionStrategy: NoDimensionQueryResultsProcessor<
  Record<string, { [metricName: string]: number }>
> = {
  parseQueryResults(query, results) {
    const columnIds = results.columns.columnIds;

    const resultsByUrl: Record<string, { [metricName: string]: number }> =
      Object.fromEntries(
        results.rows.map((row) => [
          row.value,
          Object.fromEntries(
            row.data
              // filter out "NaN"s
              .filter((value) => typeof value !== 'string')
              .map((value, index) => [
                columnIds[index] as AAMetricName,
                value as number,
              ]),
          ),
        ]),
      );

    return resultsByUrl;
  },
  dataPointToMetrics(dataPoint, resultsByUrl) {
    const { url, metrics: metricNames } = dataPoint;

    const associatedResults = url ? resultsByUrl[url.slice(-255)] : undefined;

    if (!associatedResults) {
      console.error(`
        No associated results found for url:
        ${url}
      `);
    }

    return Object.fromEntries(
      metricNames.map((metricName) => [
        `metrics.${metricName}`,
        associatedResults?.[metricName] || undefined,
      ]),
    );
  },
  toDbUpdates(dataPoints, query, queryResults) {
    const parsedData = this.parseQueryResults(query, queryResults);

    return dataPoints.map((dataPoint) => {
      const metrics = this.dataPointToMetrics(dataPoint, parsedData);

      return dataPointToBulkInsert(dataPoint, metrics);
    });
  },
};

export const withDimensionStrategy: DimensionQueryResultsProcessor<
  DimensionMetrics[]
> = {
  parseQueryResults(query, results) {
    const columnIds = results.columns.columnIds;

    return results.rows.map((row) =>
      Object.fromEntries(
        row.data
          // filter out "NaN"s
          .filter((value) => typeof value !== 'string')
          .map((value, index) => [columnIds[index], value as number])
          .concat([['dimensionValue' as const, row.value]]),
      ),
    );
  },
  // this is more or less unnecessary now, should probably get rid of it eventually
  dataPointToMetrics({ breakdownDimension }, dimensionMetrics) {
    return {
      [`metrics_by.${breakdownDimension}`]: dimensionMetrics,
    };
  },
  toDbUpdates(dataPoints, query, queryResults) {
    const parsedData = this.parseQueryResults(query, queryResults);

    const dataPointsToInsert = dataPoints.map((dataPoint) => {
      const metrics = this.dataPointToMetrics(dataPoint, parsedData);

      // we don't actually need the bulkWriteOps themselves, only a subset, but there's no need to write new logic
      const bulkWriteOps = dataPointToBulkInsert(dataPoint, metrics);

      return {
        ...dataPoint,
        filterExpression: bulkWriteOps.updateOne.filter,
        updateExpression: bulkWriteOps.updateOne
          .update as UpdateQuery<CustomReportsMetrics>,
      };
    });

    return async (db: DbService) => {
      const performUpdate = async (
        dataPointToInsert: (typeof dataPointsToInsert)[number],
      ) => {
        const { breakdownDimension, filterExpression, updateExpression } =
          dataPointToInsert;

        const newMetricsArray = updateExpression.$set![
          `metrics_by.${breakdownDimension}`
        ] as DimensionMetrics[];

        const newDataDict = arrayToDictionary(
          // ignore undefined/null dimension values
          newMetricsArray.filter((metric) => metric.dimensionValue),
          'dimensionValue',
        );

        // the easiest way to update an array of objects is to read the current value and
        // just replace the whole thing
        // ideally we would use a transaction to avoid conflicting writes,
        // but that's not possible without using replica sets

        const currentDbDoc = await db.collections.customReportsMetrics
          .findOne(filterExpression, { metrics: 0 })
          .lean()
          .exec();

        const currentDbMetrics =
          currentDbDoc?.metrics_by?.[breakdownDimension!] || [];

        const dbMetricsDict = arrayToDictionary(
          // ignore undefined/null dimension values
          currentDbMetrics.filter((metric) => metric.dimensionValue),
          'dimensionValue',
        );

        const allDimensionValues = union(
          keys(dbMetricsDict),
          keys(newDataDict),
        );

        updateExpression['$set']![`metrics_by.${breakdownDimension}`] =
          allDimensionValues.map((dimensionValue) => ({
            ...(dbMetricsDict[dimensionValue] || {}),
            ...(newDataDict[dimensionValue] || {}),
          }));

        await db.collections.customReportsMetrics.updateOne(
          filterExpression,
          updateExpression,
          { upsert: true },
        );
      };

      const results = await Promise.allSettled(
        dataPointsToInsert.map(performUpdate),
      );

      const failedResults = results.filter(
        (result) => result.status === 'rejected',
      );

      if (failedResults.length) {
        throw new Error(
          'Error(s) occurred while updating db:\n' +
            failedResults
              .map((result) => 'reason' in result && result.reason)
              .join('\n'),
        );
      }
    };
  },
};

export const groupedNoDimensionStrategy: NoDimensionQueryResultsProcessor<
  Record<string, number>
> = {
  parseQueryResults(query, results) {
    const columnIds = results.columns.columnIds;
    const row = (results.summaryData?.['totals'] || []) as (number | string)[];

    if (!row.length) {
      throw new Error('No data found for grouped data point');
    }

    return Object.fromEntries(
      row
        // filter out "NaN"s
        .filter((value) => typeof value !== 'string')
        .map((value, index) => [
          columnIds[index] as AAMetricName,
          value as number,
        ]),
    );
  },
  dataPointToMetrics(dataPoint, resultsByMetric) {
    const { metrics: metricNames } = dataPoint;

    return Object.fromEntries(
      metricNames.map((metricName) => [
        `metrics.${metricName}`,
        resultsByMetric[metricName] || undefined,
      ]),
    );
  },
  toDbUpdates(dataPoints, query, queryResults) {
    const parsedData = this.parseQueryResults(query, queryResults);

    return dataPoints.map((dataPoint) => {
      const metrics = this.dataPointToMetrics(dataPoint, parsedData);

      return dataPointToBulkInsert(dataPoint, metrics);
    });
  },
};
