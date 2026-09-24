import { ConsoleLogger, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { arrayToDictionary, today } from '@dua-upd/utils-common';
import { DbService, PortalPages } from '@dua-upd/db';
import type { DateRange, IAAItemId } from '@dua-upd/types-common';
import { AdobeAnalyticsService } from '@dua-upd/external-data';
import { queryDateFormat } from '@dua-upd/node-utils';

dayjs.extend(utc);

type Language = 'en' | 'fr';

type PortalEntry = { link: string; visits: number };

type PortalItemIdResult = {
  itemid_secureportal?: string;
  value?: string;
};

type RegistryEntry = {
  screen_id: string;
  title: string | null;
  url: string | null;
  lang: Language;
};

type LanguageItemIds = {
  language: Language;
  itemIds: IAAItemId[];
};

const PORTAL_PAGES_START_DATE = '2026-08-29';

const normalizeUrl = (url: string) => url.replace(/apps[1-8]/g, 'apps');

const topEntriesByItemId = (results: Array<Record<string, unknown>>) => {
  const topByItemId = new Map<string, PortalEntry>();

  for (const result of results) {
    for (const [itemId, entries] of Object.entries(result)) {
      if (itemId === 'date' || !Array.isArray(entries) || !entries.length) {
        continue;
      }

      const top = entries[0] as PortalEntry;
      const current = topByItemId.get(itemId);

      if (!current || top.visits > current.visits) {
        topByItemId.set(itemId, top);
      }
    }
  }

  return topByItemId;
};

@Injectable()
export class PortalPageService {
  constructor(
    private adobeAnalyticsService: AdobeAnalyticsService,
    private db: DbService,
    private logger: ConsoleLogger,
  ) {}

  async updatePortalPages(dateRange?: DateRange<string>) {
    const range = dateRange ?? {
      start: dayjs.utc(PORTAL_PAGES_START_DATE).format(queryDateFormat),
      // End is exclusive in this flow, so "today" includes all of yesterday.
      end: today().startOf('day').format(queryDateFormat),
    };

    this.logger.log(
      chalk.blueBright(`Syncing portal pages for ${range.start}/${range.end}`),
    );

    const languageResults: LanguageItemIds[] = await Promise.all(
      (['en', 'fr'] as const).map(async (language) => ({
        language,
        itemIds: await this.fetchItemIds(range, language),
      })),
    );

    await this.syncItemIds(languageResults);

    for (const { language, itemIds } of languageResults) {
      await this.updateRegistry(range, language, itemIds);
    }

    this.logger.log(chalk.green('Finished syncing portal pages.'));
  }

  private async fetchItemIds(
    dateRange: DateRange<string>,
    language: Language,
  ): Promise<IAAItemId[]> {
    const results = (
      await this.adobeAnalyticsService.getPortalScreenItemIds(
        dateRange,
        language,
      )
    ).flat() as PortalItemIdResult[];

    const itemIds: IAAItemId[] = results.flatMap((item) => {
      if (!item.itemid_secureportal || !item.value) return [];

      return [
        {
          _id: new Types.ObjectId(),
          type: 'portalPages' as const,
          itemId: item.itemid_secureportal,
          value: item.value,
        },
      ];
    });

    this.logger.log(`Got ${itemIds.length} valid ${language} portal itemIds.`);

    return itemIds;
  }

  private async syncItemIds(results: LanguageItemIds[]) {
    const allItemIds = results.flatMap(({ itemIds }) => itemIds);

    if (!allItemIds.length) {
      this.logger.log(
        'Adobe returned no portal page itemIds; nothing to sync.',
      );
      return;
    }

    const operations: AnyBulkWriteOperation<IAAItemId>[] = allItemIds.map(
      (item) => ({
        updateOne: {
          filter: {
            type: 'portalPages',
            itemId: item.itemId,
          },
          update: {
            $setOnInsert: {
              _id: new Types.ObjectId(),
            },
            $set: {
              type: 'portalPages',
              itemId: item.itemId,
              value: item.value,
            },
          },
          upsert: true,
        },
      }),
    );

    const result = await this.db.collections.aaItemIds.bulkWrite(operations, {
      ordered: false,
    });

    this.logger.log(
      `Synced ${allItemIds.length} portal itemIds: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`,
    );
  }

  private async updateRegistry(
    dateRange: DateRange<string>,
    language: Language,
    itemIdResults: IAAItemId[],
  ) {
    const itemIds = itemIdResults.map(({ itemId }) => itemId);

    if (!itemIds.length) return;

    const itemIdDictionary = arrayToDictionary(itemIdResults, 'itemId', true);

    const [titleResults, urlResults] = await Promise.all([
      this.adobeAnalyticsService.getPortalMetrics(dateRange, itemIds, language),
      this.adobeAnalyticsService.getPortalPageUrls(
        dateRange,
        itemIds,
        language,
      ),
    ]);

    const topTitleByItemId = topEntriesByItemId(
      titleResults as unknown as Array<Record<string, unknown>>,
    );

    const topUrlByItemId = topEntriesByItemId(
      urlResults as unknown as Array<Record<string, unknown>>,
    );

    const registryEntries: RegistryEntry[] = itemIds
      .map((itemId) => {
        const screenId = itemIdDictionary[itemId]?.value;

        if (!screenId) return null;

        const topUrl = topUrlByItemId.get(itemId)?.link;

        return {
          screen_id: screenId,
          title: topTitleByItemId.get(itemId)?.link ?? null,
          url: topUrl ? normalizeUrl(topUrl) : null,
          lang: language,
        };
      })
      .filter((entry): entry is RegistryEntry => !!entry);

    const operations: AnyBulkWriteOperation<PortalPages>[] =
      registryEntries.map(({ screen_id, title, url, lang }) => ({
        updateOne: {
          filter: {
            screen_id,
            lang,
          },
          update: {
            $setOnInsert: {
              _id: new Types.ObjectId(),
            },
            $set: {
              title,
              url,
              lang,
            },
          },
          upsert: true,
        },
      }));

    if (!operations.length) return;

    const result = await this.db.collections.portalPages.bulkWrite(operations, {
      ordered: false,
    });

    this.logger.log(
      `Portal pages ${language}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`,
    );
  }
}
