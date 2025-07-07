import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isBetween from 'dayjs/plugin/isBetween';
import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { BlobStorageService } from '@dua-upd/blob-storage';
import { AAItemId, DbService, PageMetrics } from '@dua-upd/db';
import type {
  ActivityMapMetrics,
  DateRange,
  IAAItemId,
} from '@dua-upd/types-common';
import {
  ActivityMapResult,
  AdobeAnalyticsService,
  BlobProxyService,
  singleDatesFromDateRange,
} from '@dua-upd/external-data';
import { queryDateFormat } from '@dua-upd/node-utils';
import {
  arrayToDictionary,
  arrayToDictionaryMultiref,
  prettyJson,
  today,
} from '@dua-upd/utils-common';

dayjs.extend(utc);
dayjs.extend(isBetween);

interface ActivityMapEntry {
  title: string;
  activity_map: ActivityMapMetrics[];
  itemId: string;
}

export type ActivityMap = ActivityMapEntry & { pages: Types.ObjectId[] };

@Injectable()
export class ActivityMapService {
  constructor(
    private adobeAnalyticsService: AdobeAnalyticsService,
    private blobProxyService: BlobProxyService,
    private logger: ConsoleLogger,
    private db: DbService,
    @Inject(BlobStorageService.name) private blob: BlobStorageService,
  ) {}

  async updateActivityMap(dateRange?: DateRange<string>) {
    try {
      const latestDateResult = () =>
        this.db.collections.pageMetrics
          .findOne(
            { 'activity_map.0': { $exists: true } },
            { activity_map: 1, date: 1 },
          )
          .sort({ date: -1 })
          .lean()
          .exec();

      const queriesDateRange = dateRange || {
        start: dayjs
          .utc((await latestDateResult())?.['date'] || new Date('2022-01-31'))
          .add(1, 'day')
          .format(queryDateFormat),
        end: today().subtract(1, 'day').endOf('day').format(queryDateFormat),
      };

      const queryStart = dayjs.utc(queriesDateRange.start);
      const queryEnd = dayjs.utc(queriesDateRange.end);

      if (queryEnd.isBefore(queryStart)) {
        this.logger.log('Page activity map already up-to-date.');
        return;
      }

      const dateRanges = (
        singleDatesFromDateRange(
          queriesDateRange,
          queryDateFormat,
          true,
        ) as string[]
      )
        .map((date: string) => ({
          start: date,
          end: dayjs.utc(date).add(1, 'day').format(queryDateFormat),
        }))
        .filter((dateRange) => {
          const gapDateStart = dayjs.utc('2022-07-01');
          const gapDateEnd = dayjs.utc('2022-12-31');

          const dateIsDuringGap = dayjs
            .utc(dateRange.start)
            .isBetween(gapDateStart, gapDateEnd, 'day', '[]');

          return (
            !dateIsDuringGap &&
            dayjs.utc(dateRange.start).startOf('day') !==
              dayjs.utc().startOf('day')
          );
        });

      const blobProxy = this.blobProxyService.createProxy({
        blobModel: 'aa_raw',
        filenameGenerator: (dates: string) => `activityMap_data_${dates}.json`,
        queryExecutor: async ([dateRange, itemIdDocs]: [
          DateRange<string>,
          IAAItemId[],
        ]) =>
          await this.adobeAnalyticsService.getPageActivityMap(
            dateRange,
            itemIdDocs,
          ),
      });

      for (const dateRange of dateRanges) {
        const requestItemIdDocs =
          await this.updateActivityMapItemIds(dateRange);

        const activityMapResults = await blobProxy.exec(
          [dateRange, requestItemIdDocs],
          `${dateRange.start.slice(0, 10)}`,
        );

        // add page refs via itemIds
        const activityMapResultsWithRefs =
          await this.addPageRefsToActivityMap(activityMapResults);

        // fix outbound links (remove incorrect values and "rename" correct ones)
        const cleanActivityMap = fixOutboundLinks(
          activityMapResultsWithRefs as ActivityMap[],
        );

        const groupedByPage: Record<string, Record<string, number>> = {};

        for (const { activity_map, pages } of cleanActivityMap) {
          for (const page of pages) {
            const pageId = page.toString();
            if (!groupedByPage[pageId]) {
              groupedByPage[pageId] = {};
            }

            for (const { link, clicks } of activity_map) {
              groupedByPage[pageId][link] =
                (groupedByPage[pageId][link] || 0) + clicks;
            }
          }
        }

        const bulkWriteOps: AnyBulkWriteOperation<PageMetrics>[] = [];

        for (const [pageId, linkClicks] of Object.entries(groupedByPage)) {
          const mergedActivityMap: ActivityMapMetrics[] = Object.entries(
            linkClicks,
          ).map(([link, clicks]) => ({ link, clicks }));

          bulkWriteOps.push({
            updateOne: {
              filter: {
                date: dayjs.utc(dateRange.start).toDate(),
                page: new Types.ObjectId(pageId),
              },
              update: {
                $set: { activity_map: mergedActivityMap },
              },
            },
          });
        }

        if (bulkWriteOps.length) {
          await this.db.collections.pageMetrics.bulkWrite(bulkWriteOps, {
            ordered: false,
          });

          this.logger.log(`Updated ${bulkWriteOps.length} records`);
        }
      }
    } catch (e) {
      this.logger.error(e);
    }
  }

  async updateActivityMapItemIds(dateRange: DateRange<string>) {
    this.logger.log(
      chalk.blueBright(
        'Updating itemIds for dateRange: ',
        prettyJson(dateRange),
      ),
    );

    const blobProxy = this.blobProxyService.createProxy({
      blobModel: 'aa_raw',
      filenameGenerator: (date: string) => `activityMap_itemIds_${date}.json`,
      queryExecutor: async (dateRange: DateRange<string>) =>
        await this.adobeAnalyticsService.getActivityMapItemIds(dateRange),
    });

    const itemIds = await blobProxy.exec(
      dateRange,
      `${dateRange.start.slice(0, 10)}`,
    );

    await this.insertItemIdsIfNew(itemIds);

    this.logger.log(chalk.green('Successfully updated itemIds.'));

    return itemIds;
  }

  async addPageRefsToItemIds(itemIds: IAAItemId[]): Promise<IAAItemId[]> {
    const urls = await this.db.collections.urls
      .find({
        all_titles: {
          $not: { $size: 0 },
          $in: itemIds.map(({ value }) => value),
        },
      })
      .lean()
      .exec();

    const urlsDict = arrayToDictionaryMultiref(urls, 'all_titles', true);

    return itemIds.map((itemId) => {
      const urls = urlsDict[itemId.value];
      const pagesFromUrls = urls ? urls.map((url) => url.page) : [];
      const currentPages = itemId.pages || (itemId.page ? [itemId.page] : []);
      const uniquePages = [...new Set([...currentPages, ...pagesFromUrls])];

      return {
        ...itemId,
        ...(uniquePages.length ? { pages: uniquePages } : {}),
      };
    });
  }

  async addPageRefsToActivityMap(
    activityMap: ActivityMapResult[],
  ): Promise<(ActivityMapResult & { pages?: Types.ObjectId[] })[]> {
    const itemIds = await this.db.collections.aaItemIds
      .find({ type: 'activityMapTitle' })
      .lean()
      .exec();

    const itemIdsDict = arrayToDictionary(itemIds, 'itemId');

    return activityMap
      .map((activityMapEntry) => {
        const { itemId } = activityMapEntry;
        const itemIdDoc = itemIdsDict[itemId];

        if (!itemIdDoc?.pages?.length) return activityMapEntry;

        return { ...activityMapEntry, pages: itemIdDoc.pages };
      })
      .filter((activityMapEntry) => 'pages' in activityMapEntry);
  }

  async insertItemIdsIfNew(itemIds: IAAItemId[]) {
    const existingItemIds = await this.db.collections.aaItemIds.find({
      type: 'activityMapTitle',
    });
    const existingItemIdsDict = arrayToDictionary(existingItemIds, 'itemId');

    const newItems = itemIds
      .filter(
        (item) =>
          !existingItemIdsDict[item.itemId] &&
          !item.value.match(/^https?:\/\//),
      )
      .map((item) => ({
        ...item,
        _id: new Types.ObjectId(),
        type: 'activityMapTitle' as const,
      }));

    const itemIdsWithPageRefs = await this.addPageRefsToItemIds(itemIds);

    const existingNeedingUpdate = itemIdsWithPageRefs.filter((item) => {
      const existing = existingItemIdsDict[item.itemId];
      if (!existing) return false;

      const dbPages = new Set(
        Array.isArray(existing.pages)
          ? existing.pages.map((p) => p.toString())
          : existing.pages
            ? [String(existing.pages)]
            : [],
      );

      const newPages = Array.isArray(item.pages)
        ? item.pages.map((p) => p.toString())
        : item.pages
          ? [String(item.pages)]
          : [];

      return newPages.some((p) => !dbPages.has(p));
    });

    if (newItems.length) {
      this.logger.log(
        chalk.blueBright('Finding valid Page references and inserting...'),
      );
      const itemIdsWithPageRefs = await this.addPageRefsToItemIds(newItems);
      await this.db.collections.aaItemIds.insertMany(itemIdsWithPageRefs);

      this.logger.log(`Inserted ${newItems.length} new itemIds`);
    } else {
      this.logger.log('No new itemIds to insert');
    }

    const bulkWriteOps: AnyBulkWriteOperation<AAItemId>[] = [];

    for (const item of existingNeedingUpdate) {
      bulkWriteOps.push({
        updateOne: {
          filter: { itemId: item.itemId, type: 'activityMapTitle' },
          update: {
            $set: { pages: item.pages },
          },
        },
      });
    }

    if (bulkWriteOps.length) {
      await this.db.collections.aaItemIds.bulkWrite(bulkWriteOps, {
        ordered: false,
      });

      this.logger.log(
        `Updated ${bulkWriteOps.length} itemId records with new pages`,
      );
    } else {
      this.logger.log('No existing itemId records need page updates');
    }
  }
}

export function fixOutboundLinks(activityMapEntries: ActivityMap[]) {
  const outboundLinkRegex = new RegExp(
    '^https?://.+?/([^/]+?\\.(?:pdf|txt|brf))$',
    'i',
  );
  const incorrectOutboundRegex = /^([^/]+?\.(?:pdf|txt|brf))$/i;

  return activityMapEntries.map((item) => ({
    ...item,
    activity_map: item.activity_map
      .filter(
        (activityMapItem) => !incorrectOutboundRegex.test(activityMapItem.link),
      )
      .map((activityMapItem) => {
        const match = outboundLinkRegex.exec(activityMapItem.link);

        if (match) {
          return { ...activityMapItem, link: match[1] };
        }

        return activityMapItem;
      }),
  }));
}
