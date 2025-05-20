import { ConsoleLogger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import chalk from 'chalk';
import { type Model, Types, type AnyBulkWriteOperation } from 'mongoose';
import { Command, CommandRunner, InquirerService } from 'nest-commander';
import { DataIntegrityService } from '@dua-upd/data-integrity';
import {
  DbService,
  Overall,
  OverallDocument,
  PageMetrics,
  PageMetricsDocument,
} from '@dua-upd/db';
import { DateRange, IPageMetrics } from '@dua-upd/types-common';
import {
  AirtableService,
  ActivityMapService,
  DbUpdateService,
  PageMetricsService,
  PagesListService,
  InternalSearchTermsService,
} from '@dua-upd/db-update';
import {
  AdobeAnalyticsService,
  GoogleSearchConsoleService,
} from '@dua-upd/external-data';

export interface PopulatePipelineConfig<T> {
  dataSources: Record<string, () => Promise<T[] | void>>;
  mergeBeforeInsert?: (
    allResults: Record<string, T[]>,
    context: Record<string, unknown>,
  ) => T[];
  onBeforeInsert?: (
    data: T[],
    context: Record<string, unknown>,
  ) => T[] | Promise<T[]>;
  insertFn: (data: T[], context: Record<string, unknown>) => Promise<void>;
  insertWithHooks?: boolean;
  onComplete?: (context: Record<string, unknown>) => Promise<void>;
}

export const assemblePipeline = <T>(
  pipelineConfig: PopulatePipelineConfig<T>,
  logger = console,
) => {
  const {
    dataSources,
    mergeBeforeInsert,
    insertFn,
    onBeforeInsert,
    insertWithHooks,
    onComplete,
  } = pipelineConfig;

  const pipelineContext: Record<string, unknown> = {};

  if (mergeBeforeInsert) {
    return async () => {
      const dataSourceResults: { [Key in keyof typeof dataSources]?: T[] } = {};

      // execute in parallel and wait for all to finish
      const dataSourcePromises = Object.fromEntries(
        Object.entries(dataSources).map(([dataSourceKey, dataSource]) => [
          dataSourceKey,
          dataSource(),
        ]),
      );
      await Promise.all(Object.values(dataSourcePromises));

      // then add unwrapped result promises into new results object
      for (const [resultKey, resultPromise] of Object.entries(
        dataSourcePromises,
      )) {
        const result = await resultPromise;

        if (result) {
          dataSourceResults[resultKey] = result;
        }
      }

      const mergedResults = mergeBeforeInsert(
        dataSourceResults as Record<string, T[]>,
        pipelineContext,
      );

      const finalResults =
        (await onBeforeInsert?.(mergedResults, pipelineContext)) ??
        mergedResults;

      await insertFn(finalResults, pipelineContext);

      return await onComplete?.(pipelineContext);
    };
  }

  if (insertWithHooks) {
    return async () => {
      const promises = Object.entries(dataSources).map(
        ([dataSourceName, dataSource]) =>
          dataSource().catch((err) => {
            console.error(`Error running ${dataSourceName} pipeline:`);
            console.error(err.stack);
          }),
      );

      await Promise.all(promises);

      await onComplete?.(pipelineContext);

      return await Promise.resolve();
    };
  }

  return async () => {
    // parallelize dataSource pipelines
    const pipelines = Object.values(dataSources).map(async (dataSource) => {
      const dataSourceResults = await dataSource();

      const finalResults =
        (await onBeforeInsert?.(dataSourceResults || [], pipelineContext)) ??
        dataSourceResults;

      return insertFn(finalResults || [], pipelineContext);
    });

    const pipelineResults = await Promise.allSettled(pipelines);

    const pipelineErrorResults = pipelineResults
      .filter((result) => result.status === 'rejected')
      .map((result) => 'reason' in result && result.reason);

    if (pipelineErrorResults.length > 0) {
      logger.error('Errors while running data pipeline:');

      for (const err of pipelineErrorResults) {
        logger.error(err);
      }
    }

    return pipelineResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => 'value' in result && result.value);
  };
};

@Command({
  name: 'populate',
  description:
    'Populate the overall_metrics or pages_metrics collection with data for a certain date range',
})
export class PopulateCommand extends CommandRunner {
  constructor(
    private readonly adobeAnalyticsService: AdobeAnalyticsService,
    private readonly airtableService: AirtableService,
    private readonly activityMapService: ActivityMapService,
    private readonly searchAnalyticsService: GoogleSearchConsoleService,
    private readonly inquirerService: InquirerService,
    private readonly dataIntegrityService: DataIntegrityService,
    private readonly dbUpdateService: DbUpdateService,
    private readonly dbService: DbService,
    private readonly pagesListService: PagesListService,
    private readonly pageMetricsService: PageMetricsService,
    private readonly internalSearchService: InternalSearchTermsService,
    private logger: ConsoleLogger,
    @InjectModel(Overall.name, 'defaultConnection')
    private overallMetricsModel: Model<OverallDocument>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: Model<PageMetricsDocument>,
  ) {
    super();
  }

  // Populate prerequisite data and make sure Pages are deduplicated
  async prepareDb() {
    try {
      await this.airtableService.updatePagesList();
      this.logger.log('Published Pages list updated');

      await this.airtableService.updateUxData();

      // Updating UX data doesn't include project attachments
      await this.airtableService.uploadProjectAttachmentsAndUpdateUrls();
    } catch (err) {
      this.logger.error(err.stack);
      throw err;
    }
  }

  async run(inputs: string[], options?: Record<string, any>) {
    const { targetCollection } = await this.inquirerService.prompt<{
      targetCollection: string;
    }>('populate_collection', { ...options });

    // transform some of the input strings into more appropriate formats
    this.logger.log(targetCollection);

    if (targetCollection === 'overall_metrics') {
      const { metricsOrSearchTerms } = await this.inquirerService.prompt<{
        metricsOrSearchTerms: 'metrics' | 'search terms' | 'both';
      }>('populate_overall', { ...options });

      const { startDate, endDate } = await this.getCollectionOptions(options);

      await this.prepareDb();

      const dateRange = { start: startDate, end: endDate };

      if (metricsOrSearchTerms === 'metrics') {
        const pipelineConfig =
          this.createOverallMetricsPipelineConfig(dateRange);

        const pipeline = assemblePipeline<Overall>(pipelineConfig);

        return await pipeline();
      } else if (metricsOrSearchTerms === 'search terms') {
        return await this.internalSearchService.upsertOverallSearchTerms(
          dateRange,
        );
      }

      // both metrics + search terms
      const pipelineConfig = this.createOverallMetricsPipelineConfig(dateRange);

      const pipeline = assemblePipeline<Overall>(pipelineConfig);

      await pipeline();

      return await this.internalSearchService.upsertOverallSearchTerms(
        dateRange,
      );
    }

    if (targetCollection === 'pages_metrics') {
      const { metricsOrSearchTerms } = await this.inquirerService.prompt<{
        metricsOrSearchTerms:
          | 'metrics'
          | 'search terms'
          | 'activity map'
          | 'all';
      }>('populate_pages', { ...options });

      const { startDate, endDate } = await this.getCollectionOptions(options);

      await this.prepareDb();

      const dateRange = { start: startDate, end: endDate };

      if (metricsOrSearchTerms === 'metrics') {
        const pipelineConfig = this.createPageMetricsPipelineConfig(dateRange);

        const pipeline = assemblePipeline<Partial<PageMetrics>>(pipelineConfig);

        return await pipeline();
      } else if (metricsOrSearchTerms === 'search terms') {
        return await this.internalSearchService.upsertPageSearchTerms(
          dateRange,
        );
      } else if (metricsOrSearchTerms === 'activity map') {
        return await this.activityMapService.updateActivityMap(dateRange);
      }

      // for "all"
      const pipelineConfig = this.createPageMetricsPipelineConfig(dateRange);

      const pipeline = assemblePipeline<Partial<PageMetrics>>(pipelineConfig);

      await pipeline();

      await this.internalSearchService.upsertPageSearchTerms(dateRange);

      return await this.activityMapService.updateActivityMap(dateRange);
    }
    return Promise.resolve(undefined);
  }

  createOverallMetricsPipelineConfig(
    dateRange: DateRange<string>,
  ): PopulatePipelineConfig<Overall> {
    const aaDataSource = () =>
      this.adobeAnalyticsService.getOverallMetrics(dateRange, {
        inclusiveDateRange: true,
      });
    const gscDataSource = () =>
      this.searchAnalyticsService.getOverallMetrics(dateRange, 'final');

    return {
      dataSources: { aaData: aaDataSource, gscData: gscDataSource },
      mergeBeforeInsert: (results) => mergeByDate(Object.values(results)),
      insertFn: async (data) => {
        const bulkInsertOps = data.map((record) => ({
          updateOne: {
            filter: { date: record.date },
            update: {
              $setOnInsert: { _id: new Types.ObjectId() },
              $set: record,
            },
            upsert: true,
          },
        }));

        await this.overallMetricsModel.bulkWrite(bulkInsertOps);

        return Promise.resolve();
      },
    };
  }

  createPageMetricsPipelineConfig(
    dateRange: DateRange<string>,
  ): PopulatePipelineConfig<Partial<PageMetrics>> {
    const insertFunc = async (
      data: Partial<IPageMetrics>[],
      datasourceName?: string,
    ) => {
      if (data.length) {
        console.log(
          `[${
            datasourceName || 'datasource'
          }] (${data[0].date.toISOString()}) number of records passed to insertFunc:`,
        );
        console.log(data.length);

        const bulkInsertOps: AnyBulkWriteOperation[] = data.map((record) => ({
          updateOne: {
            filter: { url: record.url, date: record.date },
            update: {
              $setOnInsert: { _id: new Types.ObjectId() },
              $set: record,
            },
            upsert: true,
          },
        }));

        return await Promise.resolve(bulkInsertOps).then((bulkInsertOps) =>
          this.pageMetricsModel
            .bulkWrite(bulkInsertOps, { ordered: false })
            .then((bulkWriteResults) =>
              console.log(
                `[${
                  datasourceName || 'datasource'
                }] (${data[0].date.toISOString()}) bulkWrite completed`,
              ),
            )
            .catch((err) =>
              this.logger.error(
                chalk.red(`Error during bulkWrite: \r\n${err.stack}`),
              ),
            ),
        );
      }
    };

    const uniqueUrls = new Set<string>();

    const aaDataSource = async () => {
      await this.adobeAnalyticsService.getPageMetrics(dateRange, {
        onComplete: async (pageMetrics) => {
          // ignore pages w/ 0 visits (can assume everything else is 0)
          const filteredPageMetrics = pageMetrics.filter(
            (metrics) => !!metrics.visits,
          );

          const pageMetricsWithRepairedUrls =
            await this.pagesListService.repairUrls(filteredPageMetrics);

          // add urls to set to use for adding refs later
          for (const url of pageMetricsWithRepairedUrls.map(
            (pageMetrics) => pageMetrics.url,
          )) {
            uniqueUrls.add(url);
          }

          return Promise.resolve().then(() =>
            insertFunc(pageMetricsWithRepairedUrls, 'AA'),
          );
        },
      });
    };

    const gscDataSource = async () => {
      await this.searchAnalyticsService.getPageMetrics(dateRange, {
        dataState: 'final',
        onComplete: async (results) => {
          return await insertFunc(results, 'GSC');
        },
      });

      return Promise.resolve();
    };

    return {
      dataSources: { aaData: aaDataSource, gscData: gscDataSource },
      insertWithHooks: true,
      insertFn: () => Promise.resolve(null),
      onComplete: async () => {
        console.log(
          chalk.blueBright(
            `Finished inserting results -- Adding Page references to ${uniqueUrls.size} urls`,
          ),
        );

        const uniqueUrlsArray = [...uniqueUrls];

        if (uniqueUrlsArray.length !== 0) {
          await this.dbService.validatePageMetricsRefs({
            date: { $gte: dateRange.start, $lte: dateRange.end },
          });
        }

        console.log(
          chalk.green('Page Metrics updates completed successfully ✔ '),
        );
      },
    };
  }

  async getCollectionOptions(options: Record<string, unknown>) {
    return await this.inquirerService.prompt<{
      startDate: string;
      endDate: string;
    }>('populate_collection_options', { ...options });
  }
}

export function mergeByDate<T extends { date: Date }>(results: T[][]) {
  const resultsByDate = {};

  for (const resultData of results.flat()) {
    const date = resultData.date.toISOString();

    if (!resultsByDate[date]) {
      resultsByDate[date] = resultData;
      continue;
    }

    resultsByDate[date] = { ...resultsByDate[date], ...resultData };
  }

  return Object.values(resultsByDate) as T[];
}
