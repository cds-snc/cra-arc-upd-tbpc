import { ConsoleLogger, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { arrayToDictionary, today } from '@dua-upd/utils-common';
import { DbService, PortalPages } from '@dua-upd/db';
import type {
  DateRange,
  IAAItemId,
  PortalPageMetrics,
  PortalPageType,
} from '@dua-upd/types-common';
import {
  AdobeAnalyticsService,
  type PortalIdDimension,
} from '@dua-upd/external-data';
import { queryDateFormat } from '@dua-upd/node-utils';

dayjs.extend(utc);

type PortalResult = Record<string, PortalPageMetrics[]>;

type PortalItemIdResult = {
  itemid_secureportal?: string;
  value?: string;
};

type LangItemIds = {
  lang: 'en' | 'fr';
  itemIds: IAAItemId[];
};

const portalPageTypePatterns: ReadonlyArray<{
  match: string;
  type: PortalPageType;
}> = [
  { match: '/ebci', type: 'applications' },
  { match: '/awsc/cms', type: 'ams-cms' },
  { match: '/ind', type: 'individuals' },
  { match: '/bus', type: 'business' },
  { match: '/rac', type: 'represent-client' },
  { match: '/rep/t3', type: 'trusts' },
  { match: '/rpas', type: 'registered-plans' },
  { match: '/nonres', type: 'non-resident' },
  { match: '/charity', type: 'charities' },
];

const classifyPortalPageType = (
  url: string | null | undefined,
): PortalPageType | null => {
  if (!url) return null;

  const normalizedUrl = url.toLowerCase();

  return (
    portalPageTypePatterns.find(({ match }) => normalizedUrl.includes(match))
      ?.type ?? null
  );
};

export const normalizeUrl = (url: string) => url.replace(/apps[1-8]/g, 'apps');

const topEntriesByItemId = (results: PortalResult[], itemIds: string[]) => {
  const entries = results
    .flatMap((result) =>
      itemIds.flatMap((itemId) => {
        const entry = result[itemId]?.[0];

        return entry ? [{ itemId, ...entry }] : [];
      }),
    )
    .sort((a, b) => a.visits - b.visits);

  return arrayToDictionary(entries, 'itemId', true);
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
      start: dayjs
        .utc(
          (
            await this.db.collections.portalPagesMetrics
              .findOne({})
              .sort({ date: -1 })
              .lean()
              .exec()
          )?.date || '2025-02-01',
        )
        .format(queryDateFormat),
      end: today().startOf('day').format(queryDateFormat),
    };

    this.logger.log(
      chalk.blueBright(`Syncing portal pages for ${range.start}/${range.end}`),
    );

    const langResults: LangItemIds[] = await Promise.all(
      (['en', 'fr'] as const).map(async (lang) => ({
        lang,
        itemIds: await this.fetchItemIds(range, lang),
      })),
    );

    await this.syncItemIds(langResults);

    for (const { lang, itemIds } of langResults) {
      const screenIds = await this.updateRegistry(range, lang, itemIds);
      await this.updateUrlOnlyPages(range, lang, screenIds);
    }

    this.logger.log(chalk.green('Finished syncing portal pages.'));
  }

  private async fetchItemIds(
    dateRange: DateRange<string>,
    lang: 'en' | 'fr',
    idDimension?: PortalIdDimension,
  ): Promise<IAAItemId[]> {
    const results = (
      await this.adobeAnalyticsService.getPortalScreenItemIds(
        dateRange,
        lang,
        idDimension,
      )
    ).flat() as PortalItemIdResult[];

    const itemIds: IAAItemId[] = results
      .filter((item) => item.itemid_secureportal && item.value)
      .map((item) => ({
        _id: new Types.ObjectId(),
        type: 'portalPages' as const,
        itemId: item.itemid_secureportal!,
        value: item.value!,
      }));

    this.logger.log(`Got ${itemIds.length} valid ${lang} portal itemIds.`);

    return itemIds;
  }

  private async syncItemIds(results: LangItemIds[]) {
    const allItemIds = results.flatMap(({ itemIds }) => itemIds);

    if (!allItemIds.length) {
      this.logger.log(
        'Adobe returned no portal page itemIds; nothing to sync.',
      );
      return;
    }

    const bulkWriteOps: AnyBulkWriteOperation<IAAItemId>[] = allItemIds.map(
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

    const result = await this.db.collections.aaItemIds.bulkWrite(bulkWriteOps, {
      ordered: false,
    });

    this.logger.log(
      `Synced ${allItemIds.length} portal itemIds: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`,
    );
  }

  private async updateUrlOnlyPages(
    dateRange: DateRange<string>,
    lang: 'en' | 'fr',
    screenUrls: string[],
  ) {
    const urlItemIds = await this.fetchItemIds(
      dateRange,
      lang,
      'variables/evar22',
    );

    const candidates = urlItemIds
      .map(({ itemId, value }) => ({
        itemId,
        url: normalizeUrl(value),
      }))
      .filter(({ url }) => !screenUrls.includes(url));

    if (screenUrls.length) {
      const result = await this.db.collections.portalPages.deleteMany({
        lang,
        screen_id: null,
        url: { $in: screenUrls },
      });

      if (result.deletedCount) {
        this.logger.log(
          `Removed ${result.deletedCount} url-only ${lang} portal pages now associated with screen ids.`,
        );
      }
    }

    if (!candidates.length) return;

    const knownUrls = await this.db.collections.portalPages.distinct('url', {
      lang,
      url: { $in: candidates.map(({ url }) => url) },
    });

    const candidatesByUrl = new Map(
      candidates.map((candidate) => [candidate.url, candidate] as const),
    );
    const newPages = [...candidatesByUrl]
      .filter(([url]) => !knownUrls.includes(url))
      .map(([, candidate]) => candidate);

    if (!newPages.length) {
      this.logger.log(`No new url-only ${lang} portal pages.`);
      return;
    }

    const newItemIds = [
      ...new Map(
        newPages.map(({ itemId }) => [itemId, itemId] as const),
      ).keys(),
    ];

    const titleResults: PortalResult[] =
      await this.adobeAnalyticsService.getPortalPageTitle(
        dateRange,
        newItemIds,
        lang,
        'variables/evar22',
      );

    const topTitleByItemId = topEntriesByItemId(titleResults, newItemIds);

    const bulkWriteOps: AnyBulkWriteOperation<PortalPages>[] = newPages.map(
      ({ itemId, url }) => ({
        updateOne: {
          filter: { url, lang, screen_id: null },
          update: {
            $setOnInsert: { _id: new Types.ObjectId() },
            $set: {
              title: topTitleByItemId[itemId]?.link ?? null,
              url,
              type: classifyPortalPageType(url),
              lang,
            },
          },
          upsert: true,
        },
      }),
    );

    const result = await this.db.collections.portalPages.bulkWrite(
      bulkWriteOps,
      { ordered: false },
    );

    this.logger.log(
      `Url-only portal pages ${lang}: ${result.upsertedCount} inserted.`,
    );
  }

  private async updateRegistry(
    dateRange: DateRange<string>,
    lang: 'en' | 'fr',
    itemIdResults: IAAItemId[],
  ): Promise<string[]> {
    const existingPages = await this.db.collections.portalPages
      .find(
        { lang, screen_id: { $type: 'string' } },
        { screen_id: 1, url: 1, urls: 1 },
      )
      .lean()
      .exec();
    const existingUrlsByScreenId = new Map<string, string[]>();
    for (const { screen_id, url, urls } of existingPages) {
      if (!screen_id) continue;

      const knownUrls = existingUrlsByScreenId.get(screen_id) ?? [];
      for (const existingUrl of [...(urls ?? []), ...(url ? [url] : [])]) {
        if (!knownUrls.includes(existingUrl)) knownUrls.push(existingUrl);
      }
      existingUrlsByScreenId.set(screen_id, knownUrls);
    }

    const existingScreenUrls = existingPages
      .flatMap(({ url, urls }) => [...(urls ?? []), ...(url ? [url] : [])])
      .filter((url, index, pageUrls) => pageUrls.indexOf(url) === index);
    const itemIdById = new Map(
      itemIdResults.map((item) => [item.itemId, item] as const),
    );
    const itemIds = [...itemIdById.keys()];

    if (!itemIds.length) return existingScreenUrls;

    const [titleResults, urlResults]: [PortalResult[], PortalResult[]] =
      await Promise.all([
        this.adobeAnalyticsService.getPortalPageTitle(dateRange, itemIds, lang),
        this.adobeAnalyticsService.getPortalPageUrls(dateRange, itemIds, lang),
      ]);

    const topTitleByItemId = topEntriesByItemId(titleResults, itemIds);
    const groupedEntries = new Map<
      string,
      {
        title: string | null;
        titleVisits: number;
        urls: Map<string, number>;
      }
    >();

    for (const itemId of itemIds) {
      const screenId = itemIdById.get(itemId)?.value;

      if (!screenId) continue;

      let group = groupedEntries.get(screenId);

      if (!group) {
        group = {
          title: null,
          titleVisits: -1,
          urls: new Map(
            (existingUrlsByScreenId.get(screenId) ?? []).map((url) => [
              url,
              -1,
            ]),
          ),
        };
        groupedEntries.set(screenId, group);
      }

      const title = topTitleByItemId[itemId];
      if (title && title.visits > group.titleVisits) {
        group.title = title.link;
        group.titleVisits = title.visits;
      }

      for (const result of urlResults) {
        for (const { link, visits } of result[itemId] ?? []) {
          const url = normalizeUrl(link);
          group.urls.set(url, Math.max(group.urls.get(url) ?? 0, visits));
        }
      }
    }

    const registryEntries = [...groupedEntries].map(
      ([screen_id, { title, urls }]) => {
        const groupedUrls = [...urls]
          .sort(([, visitsA], [, visitsB]) => visitsB - visitsA)
          .map(([url]) => url);

        return {
          screen_id,
          title,
          url: groupedUrls[0] ?? null,
          urls: groupedUrls,
          lang,
        };
      },
    );
    const screenIds = [
      ...existingScreenUrls,
      ...registryEntries.flatMap(({ urls }) => urls),
    ].filter((url, index, allScreenIds) => allScreenIds.indexOf(url) === index);

    const bulkWriteOps: AnyBulkWriteOperation<PortalPages>[] =
      registryEntries.map(({ screen_id, title, url, urls, lang }) => ({
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
              type: classifyPortalPageType(url),
              urls,
              lang,
            },
          },
          upsert: true,
        },
      }));

    if (!bulkWriteOps.length) return screenIds;

    const result = await this.db.collections.portalPages.bulkWrite(
      bulkWriteOps,
      { ordered: false },
    );

    this.logger.log(
      `Portal pages ${lang}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`,
    );

    return screenIds;
  }
}
