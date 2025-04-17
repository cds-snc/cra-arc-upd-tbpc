import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import {
  AdobeAnalyticsClient,
  AdobeAnalyticsService,
  GoogleSearchConsoleService,
  SearchAnalyticsClient,
} from '@dua-upd/external-data';
import { InjectModel } from '@nestjs/mongoose';
import { Overall, OverallDocument } from '@dua-upd/db';
import { Model, Types } from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Retry, today } from '@dua-upd/utils-common';
import { DateRange } from '@dua-upd/types-common';
import { assemblePipeline, PipelineConfig } from '../pipelines';

dayjs.extend(utc);

@Injectable()
export class OverallMetricsService {
  constructor(
    @Inject(AdobeAnalyticsClient.name)
    private adobeAnalyticsClient: AdobeAnalyticsClient,
    private adobeAnalyticsService: AdobeAnalyticsService,
    @Inject(SearchAnalyticsClient.name)
    private gscClient: SearchAnalyticsClient,
    private searchAnalyticsService: GoogleSearchConsoleService,
    private logger: ConsoleLogger,
    @InjectModel(Overall.name, 'defaultConnection')
    private overallMetricsModel: Model<OverallDocument>,
  ) {}

  @Retry(4, 1000)
  async updateOverallMetrics() {
    // get dates required for query
    const latestDateResults = await this.overallMetricsModel
      .find({}, { date: 1 })
      .sort({ date: -1 })
      .limit(1)
      .exec();

    // get the most recent date from the DB, and set the start date to the next day
    const latestDate = dayjs.utc(latestDateResults[0]['date']);
    const startTime = latestDate.add(1, 'day');

    // collect data up to the start of the current day/end of the previous day
    const cutoffDate = today().subtract(1, 'day').endOf('day');

    // fetch data if our db isn't up-to-date
    if (startTime.isBefore(cutoffDate)) {
      const dateRange = {
        start: startTime.format('YYYY-MM-DD'),
        end: cutoffDate.format('YYYY-MM-DD'),
      };

      this.logger.log(
        `\r\nFetching overall metrics from AA & GSC for dates: ${dateRange.start} to ${dateRange.end}\r\n`,
      );

      const pipelineConfig = this.createOverallMetricsPipelineConfig(dateRange);

      const pipeline = assemblePipeline<Overall>(pipelineConfig);

      await pipeline();
    } else {
      this.logger.log('Overall metrics already up-to-date.');
    }
  }

  createOverallMetricsPipelineConfig(
    dateRange: DateRange<string>,
  ): PipelineConfig<Overall> {
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
            filter: {
              date: record.date,
            },
            update: {
              $setOnInsert: {
                _id: new Types.ObjectId(),
              },
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
