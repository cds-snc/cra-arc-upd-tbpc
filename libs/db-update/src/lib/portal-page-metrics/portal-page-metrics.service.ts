import { ConsoleLogger, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { arrayToDictionary, today } from '@dua-upd/utils-common';
import { DbService, PortalPagesMetrics } from '@dua-upd/db';
import type { DateRange } from '@dua-upd/types-common';
import {
  AdobeAnalyticsService,
  type PortalIdDimension,
} from '@dua-upd/external-data';
import { normalizeUrl } from '../portal-page/portal-page.service';

dayjs.extend(utc);

type PortalPageRef = {
  _id: Types.ObjectId;
  screen_id: string | null;
  url: string | null;
  lang?: 'en' | 'fr';
};

type Metrics = Record<string, number>;

// Sums counts; average_time_spent is weighted by visits
const mergeMetrics = (a: Metrics, b: Metrics): Metrics => {
  const merged: Metrics = { ...a };

  for (const metric of Object.keys(b)) {
    const value = b[metric];

    if (typeof value === 'number') {
      merged[metric] = (a[metric] ?? 0) + value;
    }
  }

  const visits = merged['visits'] ?? 0;

  merged['average_time_spent'] = visits
    ? ((a['average_time_spent'] ?? 0) * (a['visits'] ?? 0) +
        (b['average_time_spent'] ?? 0) * (b['visits'] ?? 0)) /
      visits
    : 0;

  return merged;
};

@Injectable()
export class PortalPagesMetricsService {
  constructor(
    private adobeAnalyticsService: AdobeAnalyticsService,
    private db: DbService,
    private logger: ConsoleLogger,
  ) {}

  async updatePortalPagesMetrics(dateRange?: DateRange<string>): Promise<void> {
    const range = dateRange ?? (await this.getRequiredDateRange());

    if (!range) {
      this.logger.log('Portal pages metrics already up-to-date.');
      return;
    }
    const portalPages = await this.db.collections.portalPages
      .find({})
      .lean()
      .exec();

    this.logger.log(
      `Fetched ${portalPages.length} portal pages from the database.`,
    );

    for (const lang of ['en', 'fr'] as const) {
      await this.updateLanguageMetrics(
        range,
        lang,
        portalPages as PortalPageRef[],
      );
    }

    this.logger.log(chalk.green('Finished updating portal page metrics.'));
  }

  private async getRequiredDateRange(): Promise<DateRange<string> | null> {
    const latestDateResult = await this.db.collections.portalPagesMetrics
      .findOne({}, { date: 1 })
      .sort({ date: -1 })
      .lean()
      .exec();
    const latestDate = latestDateResult?.date
      ? dayjs.utc(latestDateResult.date)
      : dayjs.utc('2025-01-31');
    const startTime = latestDate.add(1, 'day');
    const cutoffDate = today().subtract(1, 'day');

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
    lang: 'en' | 'fr',
    portalPages: PortalPageRef[],
  ): Promise<void> {
    const langPages = portalPages.filter((page) => page.lang === lang);

    await this.upsertMetrics(
      dateRange,
      lang,
      'variables/evar8',
      langPages.filter((page) => page.screen_id),
      'screen_id',
    );

    // Url-only pages; urls not in portal_pages are counted as unmatched and skipped
    await this.upsertMetrics(
      dateRange,
      lang,
      'variables/evar22',
      langPages.filter((page) => !page.screen_id && page.url),
      'url',
    );
  }

  private async upsertMetrics(
    dateRange: DateRange<string>,
    lang: 'en' | 'fr',
    idDimension: PortalIdDimension,
    pages: PortalPageRef[],
    key: 'screen_id' | 'url',
  ): Promise<void> {
    if (!pages.length) return;

    const pagesByKey = arrayToDictionary(pages, key, true);

    const metricsByPageDate: Record<
      string,
      { date: Date; pageId: Types.ObjectId; metrics: Metrics }
    > = {};

    let unmatched = 0;

    await this.adobeAnalyticsService.getPortalPages(dateRange, lang, {
      idDimension,
      onComplete: async (results) => {
        for (const { date, url, ...rest } of results) {
          const pageKey = key === 'url' ? normalizeUrl(url) : url;
          const page = pagesByKey[pageKey];

          if (!page) {
            unmatched += 1;
            continue;
          }

          const metrics = rest as Metrics;
          const pageDateKey = `${page._id}|${date.getTime()}`;
          const existing = metricsByPageDate[pageDateKey];

          metricsByPageDate[pageDateKey] = {
            date,
            pageId: page._id,
            metrics: existing
              ? mergeMetrics(existing.metrics, metrics)
              : metrics,
          };
        }
      },
    });

    const bulkWriteOps: AnyBulkWriteOperation<PortalPagesMetrics>[] =
      Object.keys(metricsByPageDate).map((id) => {
        const { date, pageId, metrics } = metricsByPageDate[id];

        return {
          updateOne: {
            filter: { date, pages: pageId, language: lang },
            update: {
              $setOnInsert: { _id: new Types.ObjectId() },
              $set: { pages: pageId, language: lang, ...metrics },
            },
            upsert: true,
          },
        };
      });

    if (!bulkWriteOps.length) {
      this.logger.log(`No ${lang} portal page metrics to update (${key}).`);
      return;
    }

    await this.db.collections.portalPagesMetrics.bulkWrite(bulkWriteOps, {
      ordered: false,
    });

    this.logger.log(
      `Portal metrics ${lang} (${key}): ${bulkWriteOps.length} records updated${
        unmatched ? `, ${unmatched} unmatched` : ''
      }.`,
    );
  }
}
