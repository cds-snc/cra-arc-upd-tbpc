import { ConsoleLogger, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { today } from '@dua-upd/utils-common';
import { DbService, PortalPagesMetrics } from '@dua-upd/db';
import type { DateRange } from '@dua-upd/types-common';
import { AdobeAnalyticsService } from '@dua-upd/external-data';
import { queryDateFormat } from '@dua-upd/node-utils';

dayjs.extend(utc);

type Language = 'en' | 'fr';

type PortalPageRef = {
  _id: Types.ObjectId;
  screen_id: string;
  title: string | null;
  lang?: Language;
};

type PortalMetricsResult = {
  date: string;
  screen_id: string;
  [metric: string]: unknown;
};

@Injectable()
export class PortalPagesMetricsService {
  constructor(
    private adobeAnalyticsService: AdobeAnalyticsService,
    private db: DbService,
    private logger: ConsoleLogger,
  ) {}

  async updatePortalPagesMetrics(dateRange?: DateRange<string>) {
    const range = dateRange ?? (await this.getRequiredDateRange());

    if (!range) {
      this.logger.log('Portal pages metrics already up-to-date.');
      return;
    }
    const portalPages = await this.db.collections.portalPages.find({}).lean().exec();

    this.logger.log('Fetched ' + portalPages.length + ' portal pages from the database.');

    if (!portalPages.length) {
      this.logger.warn(
        'Portal page registry/itemIds are empty. Run PortalPagesService first.',
      );
      return;
    }

    const validScreenIds = new Set(
      portalPages.map(({ screen_id }) => screen_id).filter(Boolean),
    );

    this.logger.log(validScreenIds.size + 'validScreeenIds foudm')

    for (const language of ['en', 'fr'] as const) {
      await this.updateLanguageMetrics(
        range,
        language,
        portalPages as PortalPageRef[],
        validScreenIds,
      );
    }

    this.logger.log(chalk.green('Finished updating portal page metrics.'));
  }

  private async getRequiredDateRange(): Promise<DateRange<string> | null> {
    const latestDateResults = await this.db.collections.portalPagesMetrics
      .findOne({}, { date: 1 })
      .sort({ date: -1 });

    // get the most recent date from the DB, and set the start date to the next day
    const latestDate = latestDateResults?.date
      ? dayjs.utc(latestDateResults['date'])
      : dayjs.utc('2026-08-28');
    const startTime = latestDate.add(1, 'day');

    // collect data up to the previous day
    const cutoffDate = today().subtract(1, 'day');

    // fetch data if our db isn't up-to-date
    if (!startTime.isSameOrBefore(cutoffDate)) {
      return null;
    }

    return {
      start: startTime.format('YYYY-MM-DD'),
      end: cutoffDate.format('YYYY-MM-DD'),
    };
  }

  private async updateLanguageMetrics(
    dateRange: DateRange<string>,
    language: Language,
    portalPages: PortalPageRef[],
    validScreenIds: Set<string>,
  ) {
    const pagesByScreenId = new Map(
      portalPages
        .filter(
          (page) =>
            page.lang === language && validScreenIds.has(page.screen_id),
        )
        .map((page) => [page.screen_id, page]),
    );

    if (!pagesByScreenId.size) return;

    const operations: AnyBulkWriteOperation<PortalPagesMetrics>[] = [];
    let unmatched = 0;

    await this.adobeAnalyticsService.getPortalPages(
      dateRange,
      language,
      {
        onComplete: async (results) => {
          for (const result of results) {
            const { date, url, ...metrics } = result;
            const page = pagesByScreenId.get(url);

            if (!page) {
              unmatched += 1;
              continue;
            }

            operations.push({
              updateOne: {
                filter: {
                  date,
                  pages: page._id,
                  language,
                },
                update: {
                  $setOnInsert: { _id: new Types.ObjectId() },
                  $set: {
                    pages: page._id,
                    language,
                    ...metrics,
                  },
                },
                upsert: true,
              },
            });
          }
        },
      },
    );

    if (!operations.length) {
      this.logger.log(`No ${language} portal page metrics to update.`);
      return;
    }

    await this.db.collections.portalPagesMetrics.bulkWrite(operations, {
      ordered: false,
    });

    this.logger.log(
      `Portal metrics ${language}: ${operations.length} records updated${
        unmatched ? `, ${unmatched} unmatched screen IDs` : ''
      }.`,
    );
  }
}
