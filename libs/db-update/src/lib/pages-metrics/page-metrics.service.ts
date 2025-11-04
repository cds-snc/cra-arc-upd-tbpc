import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { type Model, Types, type AnyBulkWriteOperation } from 'mongoose';
import { today } from '@dua-upd/utils-common';
import { DateRange, IPageMetrics } from '@dua-upd/types-common';
import {
  Page,
  PageMetrics,
  PagesList,
  type PageMetricsModel,
  DbService,
} from '@dua-upd/db';
import {
  AdobeAnalyticsClient,
  SearchAnalyticsClient,
  AirtableClient,
  AdobeAnalyticsService,
  GoogleSearchConsoleService,
} from '@dua-upd/external-data';
import { PagesListService } from '../pages-list/pages-list.service';
import { PipelineConfig, assemblePipeline } from '../pipelines';

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);

@Injectable()
export class PageMetricsService {
  constructor(
    @Inject(AdobeAnalyticsClient.name)
    private adobeAnalyticsClient: AdobeAnalyticsClient,
    private adobeAnalyticsService: AdobeAnalyticsService,
    @Inject(AirtableClient.name) private airtableClient: AirtableClient,
    private dbService: DbService,
    @Inject(SearchAnalyticsClient.name)
    private gscClient: SearchAnalyticsClient,
    private searchAnalyticsService: GoogleSearchConsoleService,
    private logger: ConsoleLogger,
    @InjectModel(Page.name, 'defaultConnection') private pageModel: Model<Page>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: PageMetricsModel,
    @InjectModel(PagesList.name, 'defaultConnection')
    private pageListModel: Model<PagesList>,
    private pagesListService: PagesListService,
  ) {}

  async upsertPageMetrics(pageMetrics: PageMetrics[]) {
    const bulkInsertOps: AnyBulkWriteOperation<PageMetrics>[] = [];

    for (const pageMetric of pageMetrics) {
      const { _id, ...pageMetricNoId } = pageMetric;

      bulkInsertOps.push({
        updateOne: {
          filter: { url: pageMetric.url, date: pageMetric.date },
          update: {
            $setOnInsert: { _id: pageMetric._id },
            $set: pageMetricNoId,
          },
          upsert: true,
        },
      });
    }

    return this.pageMetricsModel.bulkWrite(bulkInsertOps);
  }

  async updatePageMetrics() {
    this.logger.log('Starting page metrics updates...');
    // get dates required for query
    const latestDateResults = await this.pageMetricsModel
      .findOne({}, { date: 1 })
      .sort({ date: -1 });

    // get the most recent date from the DB, and set the start date to the next day
    const latestDate = latestDateResults?.date
      ? dayjs.utc(latestDateResults['date'])
      : dayjs.utc('2020-01-01');
    const startTime = latestDate.add(1, 'day');

    // collect data up to the previous day
    const cutoffDate = today().subtract(1, 'day');

    // fetch data if our db isn't up-to-date
    if (startTime.isSameOrBefore(cutoffDate)) {
      const dateRange = {
        start: startTime.format('YYYY-MM-DD'),
        end: cutoffDate.format('YYYY-MM-DD'),
      };

      const pipelineConfig = this.createPageMetricsPipelineConfig(dateRange);

      const pipeline = assemblePipeline<Partial<IPageMetrics>>(pipelineConfig);

      await pipeline();

      return await Promise.resolve();
    } else {
      this.logger.log('Page metrics already up-to-date.');
    }
  }

  createPageMetricsPipelineConfig(
    dateRange: DateRange<string>,
  ): PipelineConfig<Partial<IPageMetrics>> {
    const insertFunc = async (
      data: Partial<IPageMetrics>[],
      datasourceName?: string,
    ) => {
      if (data.length) {
        console.log(
          `[${
            datasourceName || 'datasource'
          }] (${data[0].date!.toISOString()}) number of records passed to insertFunc:`,
        );
        console.log(data.length);

        const bulkInsertOps: AnyBulkWriteOperation<PageMetrics>[] = data.map(
          (record) => ({
            updateOne: {
              filter: { url: record.url, date: record.date },
              update: {
                $setOnInsert: { _id: new Types.ObjectId() },
                $set: record,
              },
              upsert: true,
            },
          }),
        );

        return await Promise.resolve(bulkInsertOps).then((bulkInsertOps) =>
          this.pageMetricsModel
            .bulkWrite(bulkInsertOps, { ordered: false })
            .then(() =>
              console.log(
                `[${
                  datasourceName || 'datasource'
                }] (${data[0].date!.toISOString()}) bulkWrite completed`,
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

    const aaDataSource = async () => {
      await this.adobeAnalyticsService.getPageMetrics(dateRange, {
        onComplete: async (pageMetrics) => {
          // ignore pages w/ 0 visits (can assume everything else is 0)
          const filteredPageMetrics = pageMetrics.filter(
            (metrics) => !!metrics.visits,
          );

          const pageMetricsWithRepairedUrls =
            await this.pagesListService.repairUrls(filteredPageMetrics);

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
      insertFn: () => Promise.resolve(),
      onComplete: async () => {
        console.log(
          chalk.blueBright(
            `Finished inserting results -- Adding Page references`,
          ),
        );

        await this.dbService.validatePageMetricsRefs({
          date: { $gte: dateRange.start, $lte: dateRange.end },
        });

        console.log(
          chalk.green('Page Metrics updates completed successfully ✔ '),
        );
      },
    };
  }
}
