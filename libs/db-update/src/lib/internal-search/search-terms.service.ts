import { ConsoleLogger, Injectable } from '@nestjs/common';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Types, type AnyBulkWriteOperation } from 'mongoose';
import {
  arrayToDictionary,
  logJson,
  prettyJson,
  today,
} from '@dua-upd/utils-common';
import { DbService, PageMetrics } from '@dua-upd/db';
import type {
  DateRange,
  IAAItemId,
  IOverall,
  AASearchTermMetrics,
} from '@dua-upd/types-common';
import {
  AdobeAnalyticsService,
  BlobProxyService,
  InternalSearchResult,
  singleDatesFromDateRange,
} from '@dua-upd/external-data';
import { queryDateFormat, writeLogFile } from '@dua-upd/node-utils';

dayjs.extend(utc);

@Injectable()
export class InternalSearchTermsService {
  constructor(
    private adobeAnalyticsService: AdobeAnalyticsService,
    private blobProxyService: BlobProxyService,
    private db: DbService,
    private logger: ConsoleLogger,
  ) {}

  /*
   * ItemId stuff
   */
  async addPageRefsAndUpsertValidItemIds(itemIds: IAAItemId[]) {
    this.logger.log(
      chalk.blueBright('Finding valid Page references and inserting...'),
    );

    /*
     * Step 0: Separate full urls from partial (248+ characters) urls
     *
     * We pretty much have to assume they're partial if they don't end in ".html",
     *   otherwise it could be a valid 247-character url.
     */
    const { fullUrlItemIds, partialUrlItemIds } = itemIds.reduce(
      ({ fullUrlItemIds, partialUrlItemIds }, itemId) => {
        if (itemId.value.endsWith('.html')) {
          fullUrlItemIds.push(itemId);
        } else {
          partialUrlItemIds.push(itemId);
        }

        return { fullUrlItemIds, partialUrlItemIds };
      },
      {
        fullUrlItemIds: [] as IAAItemId[],
        partialUrlItemIds: [] as IAAItemId[],
      },
    );

    // Declaring these here to provide count after
    const partialsToInsert: IAAItemId[] = [];
    const itemIdsToInsert: IAAItemId[] = [];

    /*
     * Step 1: Deal with partials
     */

    if (partialUrlItemIds.length) {
      /*
       * Step 1a: Find Pages who's (non-duplicate) first 247 characters of urls
       *          correspond with an itemId's url
       *
       *
       */

      // get NON-DUPLICATE first 247 chars of page urls
      const uniqueFirst247UrlPages = await this.db.collections.pages
        .aggregate<{ page: Types.ObjectId; url_first247: string }>()
        .project({
          url_first247: {
            $substrCP: ['$url', 0, 247],
          },
        })
        .group({
          _id: '$url_first247', page: { $push: '$_id', },
          count: {
            $sum: 1,
          },
        })
        .match({
          count: 1,
        })
        .project({
          _id: 0,
          page: {
            $arrayElemAt: ['$page', 0],
          },
          url_first247: '$_id',
        })
        .exec();

      /*
       * Step 1b: Insert ItemIds (that have partial urls) if they match a Page
       */
      const first247PageMap = arrayToDictionary<{
        page: Types.ObjectId;
        url_first247: string;
      }>(uniqueFirst247UrlPages, 'url_first247');

      //     for each itemId:
      //       -if search url match page -> add ref
      for (const itemId of partialUrlItemIds) {
        const itemIdUrl = itemId.value.replace('https://', '');
        const page = first247PageMap[itemIdUrl]?.page;

        if (page) {
          partialsToInsert.push({
            ...itemId,
            page,
          });
        }
      }

      // insert
      if (partialsToInsert.length) {
        this.logger.log(
          chalk.blue(
            `${partialsToInsert.length} itemIds (248+ chars.) with matching Pages found`,
          ),
        );

        const updateOps: AnyBulkWriteOperation<IAAItemId>[] = partialsToInsert.map(
          (itemId) => ({
            updateOne: {
              filter: { itemId: itemId.itemId },
              update: {
                $setOnInsert: {
                  _id: new Types.ObjectId(),
                },
                $set: {
                  type: itemId.type,
                  page: itemId.page,
                  value: itemId.value,
                  itemId: itemId.itemId,
                },
              },
              upsert: true,
            },
          }),
        );

        await this.db.collections.aaItemIds.bulkWrite(
          updateOps,
        );
      }
    }
    /*
     * If we can't match them to pages, they're no good to us anyways. So we're done with partials.
     */

    /*
     * Step 2: Full urls
     *
     * Find itemIds that match a Page, add refs, and insert (much easier)
     */
    if (fullUrlItemIds.length) {
      const cleanedItemIdUrls = fullUrlItemIds.map(({ value }) =>
        value.replace('https://', ''),
      );

      const matchingPages = await this.db.collections.pages
        .aggregate<{ url: string; page: Types.ObjectId }>()
        .project({ url: 1 })
        .sort({ url: 1 })
        .match({ url: { $in: cleanedItemIdUrls } })
        .project({
          _id: 0,
          page: '$_id',
          url: '$url',
        })
        .exec();

      const pagesDict = arrayToDictionary<{
        url: string;
        page: Types.ObjectId;
      }>(matchingPages, 'url');

      for (const itemId of fullUrlItemIds) {
        const itemIdUrl = itemId.value.replace('https://', '');
        const page = pagesDict[itemIdUrl]?.page;

        if (page) {
          itemIdsToInsert.push({
            ...itemId,
            page,
          });
        }
      }

      if (itemIdsToInsert.length) {
        this.logger.log(
          chalk.blueBright(
            `Upserting ${itemIdsToInsert.length} itemIds with matching Pages`,
          ),
        );

        const updateOps: AnyBulkWriteOperation<IAAItemId>[] = itemIdsToInsert.map(
          (itemId) => ({
            updateOne: {
              filter: { itemId: itemId.itemId },
              update: {
                $setOnInsert: {
                  _id: new Types.ObjectId(),
                },
                $set: {
                  type: itemId.type,
                  page: itemId.page,
                  value: itemId.value,
                  itemId: itemId.itemId,
                },
              },
              upsert: true,
            },
          }),
        );

        await this.db.collections.aaItemIds.bulkWrite(
          updateOps,
        );
      }
    }

    const totalInserted = [...partialsToInsert, ...itemIdsToInsert];

    if (totalInserted.length) {
      this.logger.log(
        chalk.green(
          `${totalInserted.length} new internalSearch itemIds successfully inserted/upserted!`,
        ),
      );
    } else {
      this.logger.log(
        chalk.blueBright(
          `${totalInserted.length} new internalSearch itemIds inserted.`,
        ),
      );
    }
  }

  async insertItemIdsIfNew(itemIds: IAAItemId[]) {
    // pull existing itemIds from db & compare number
    const itemIdsModel = this.db.collections.aaItemIds;

    const existingItemIds =
      (await itemIdsModel
        .find({
          itemId: { $in: itemIds.map(({ itemId }) => itemId) },
        })
        .exec()) || [];

    // if the db finds the same amount as we're checking against, we know we already have them all
    if (itemIds.length === existingItemIds.length) {
      this.logger.log(chalk.blueBright('All itemIds already in db.'));
      return;
    }

    const existingItemIdSet = new Set(
      existingItemIds.map(({ itemId }) => itemId),
    );

    const newItemIds = itemIds.filter(
      ({ itemId }) => !existingItemIdSet.has(itemId),
    );

    if (newItemIds.length) {
      try {
        await this.addPageRefsAndUpsertValidItemIds(newItemIds);
      } catch (err) {
        this.logger.error(chalk.red('Error inserting new itemIds:'));
        this.logger.error(chalk.red(err));

        return;
      }

      this.logger.log(chalk.green('Successfully inserted new itemIds!'));
    }
  }

  async updateInternalSearchItemIds(dateRange: DateRange<string>) {
    try {
      this.logger.log(
        chalk.blueBright(
          'Updating itemIds for dateRange: ',
          prettyJson(dateRange),
        ),
      );

      const blobProxy = this.blobProxyService.createProxy({
        blobModel: 'aa_raw',
        filenameGenerator: (date: string) => `searchterms/itemIds_${date}.json`,
        queryExecutor: async (dateRange: DateRange<string>) =>
          await this.adobeAnalyticsService.getInternalSearchItemIds(dateRange),
      });

      const itemIds = await blobProxy.exec(
        dateRange,
        `${dateRange.start.slice(0, 10)}_${dateRange.end.slice(0, 10)}`,
      );

      await this.insertItemIdsIfNew(itemIds);

      this.logger.log(chalk.green('Successfully updated itemIds.'));

      return itemIds;
    } catch (err) {
      this.logger.error(chalk.red('Error updating itemIds:'));
      this.logger.error(chalk.red(err.stack));
    }
  }

  async upsertOverallSearchTerms(dateRange?: DateRange<string>) {
    // if no dateRange provided, set to "latest date from DB" to "yesterday"
    const latestDateResults = await this.db.collections.overall
      .findOne(
        {
          $or: [
            { aa_searchterms_en: { $exists: true, $not: { $size: 0 } } },
            { aa_searchterms_fr: { $exists: true, $not: { $size: 0 } } },
          ],
        },
        { date: 1 },
      )
      .sort({ date: -1 })
      .exec();

    // get the most recent date from the DB, and set the start date to the next day

    // collect data up to the start of the current day/end of the previous day
    const queryDateRange = dateRange || {
      start: dayjs
        .utc(latestDateResults['date'])
        .add(1, 'day')
        .format('YYYY-MM-DD'),
      end: today().subtract(1, 'day').endOf('day').format('YYYY-MM-DD'),
    };

    const queryStart = dayjs.utc(queryDateRange.start);
    const queryEnd = dayjs.utc(queryDateRange.end);

    const formattedDateRange = `${queryDateRange.start}/${queryDateRange.end}`;

    if (queryEnd.isBefore(queryStart)) {
      this.logger.log('Overall search terms already up-to-date.');
      return;
    }

    await this.updateInternalSearchItemIds(queryDateRange);

    for (const lang of ['en', 'fr'] as ('en' | 'fr')[]) {
      this.logger.log(
        chalk.blueBright(
          `Updating overall ${lang} search terms for ${formattedDateRange}`,
        ),
      );

      const insertFunction = async (
        results: (AASearchTermMetrics & { date: Date })[],
      ) => {
        this.logger.log(
          chalk.blueBright(
            `Got ${results.length} ${lang} overall search terms`,
          ),
        );

        if (!results.length) {
          this.logger.warn(
            chalk.yellow(
              `Received no overall ${lang} searchterms results for ${formattedDateRange}`,
            ),
          );

          return [];
        }

        const date = results[0].date;

        const propName = `aa_searchterms_${lang}`;

        const insertDocument: Partial<IOverall> = {
          date,
          [propName]: results.map((result) => {
            delete result.date;

            return result;
          }),
        };

        try {
          await this.db.collections.overall.updateOne(
            { date },
            {
              $setOnInsert: {
                _id: new Types.ObjectId(),
              },
              $set: insertDocument,
            },
            {
              upsert: true,
            },
          );

          this.logger.log(
            chalk.green(
              `Successfully inserted ${results.length} ${lang} overall search terms! (${date})`,
            ),
          );
        } catch (err) {
          this.logger.error(
            chalk.red(
              'An error occurred while trying to insert overall search terms',
            ),
          );

          throw Error(err);
        }
      };

      await this.adobeAnalyticsService.getOverallSearchTerms(
        queryDateRange,
        lang,
        {
          onComplete: insertFunction.bind(this),
        },
      );

      this.logger.log(
        chalk.green(`\r\nFinished updating ${lang} overall search terms.`),
      );
    }
  }

  async upsertPageSearchTerms(dateRange?: DateRange<string>) {
    // if no dateRange provided, set to "latest date from DB" to "yesterday"
    const latestDateResult = () =>
      this.db.collections.pageMetrics
        .findOne(
          { aa_searchterms: { $exists: true, $not: { $size: 0 } } },
          { date: 1 },
        )
        .sort({ date: -1 })
        .exec();

    const queriesDateRange = dateRange || {
      start: dayjs
        .utc((await latestDateResult())?.['date'])
        .add(1, 'day')
        .format(queryDateFormat),
      end: today().subtract(1, 'day').endOf('day').format(queryDateFormat),
    };

    const queryStart = dayjs.utc(queriesDateRange.start);
    const queryEnd = dayjs.utc(queriesDateRange.end);

    if (queryEnd.isBefore(queryStart)) {
      this.logger.log('Page search terms already up-to-date.');
      return;
    }

    type SearchTermIntermediateResult = InternalSearchResult & {
      itemIdUrl: string;
      page: Types.ObjectId;
      cleanUrl: string;
    };

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
      .filter(
        (dateRange) =>
          dayjs.utc(dateRange.start).startOf('day') !==
          dayjs.utc().startOf('day'),
      );

    const blobProxy = this.blobProxyService.createProxy({
      blobModel: 'aa_raw',
      filenameGenerator: (dates: string) =>
        `searchterms/searchterms-by-itemId_${dates}.json`,
      queryExecutor: async ([dateRange, itemIdDocs]: [
        DateRange<string>,
        IAAItemId[],
      ]) =>
        await this.adobeAnalyticsService.getPageSearchTerms(
          dateRange,
          itemIdDocs,
        ),
    });

    for (const dateRange of dateRanges) {
      const noMetricsMatchSet = new Set<{
        page: Types.ObjectId;
        url: string;
      }>();

      const itemIdDocs = await this.updateInternalSearchItemIds(dateRange);

      const searchTermResults = await blobProxy.exec(
        [dateRange, itemIdDocs],
        `${dateRange.start.slice(0, 10)}_${dateRange.end.slice(0, 10)}`, // the date string to include in the filename
      );

      const dbItemIds =
        (await this.db.collections.aaItemIds
          .find({ type: 'internalSearch' })
          .lean()
          .exec()) || [];

      const itemIdDict = arrayToDictionary(dbItemIds, 'itemId');

      const resultsWithRefs = searchTermResults
        .map((searchTermResults) => {
          const itemIdData = itemIdDict[searchTermResults.itemId];
          const page = itemIdData?.page;
          const itemIdUrl = itemIdData?.value;

          delete searchTermResults.itemId;

          if (page) {
            return {
              ...searchTermResults,
              itemIdUrl,
              page,
              cleanUrl: itemIdUrl.replace('https://', ''),
            };
          }

          return searchTermResults;
        })
        .filter(
          (results) => 'page' in results,
        ) as SearchTermIntermediateResult[];

      // There can sometimes be results for the same "Page" but with different urls on the same day
      const duplicateSearchTermPageRefs = resultsWithRefs
        .map(({ page }) => `${page}`)
        .sort()
        .reduce((duplicates, pageRef, i, pageRefs) => {
          if (i !== 0 && pageRefs[i - 1] === pageRef) {
            duplicates.push(pageRef);
          }

          return duplicates;
        }, []);

      // try to match to metrics
      const pageMetricsToMatch = await this.db.collections.pageMetrics
        .find(
          {
            date: dayjs.utc(dateRange.start).toDate(),
            page: {
              $in: resultsWithRefs.map(({ page }) => new Types.ObjectId(page)),
            },
          },
          { url: 1, page: 1 },
        )
        .lean()
        .exec();

      // same as for search terms, multiple urls for the same "Page"
      // same solution: try matching by url
      const duplicatePageMetricsPageRefs = pageMetricsToMatch
        .map(({ page }) => `${page}`)
        .sort()
        .reduce((duplicates, pageRef, i, pageRefs) => {
          if (i !== 0 && pageRefs[i - 1] === pageRef) {
            duplicates.push(pageRef);
          }

          return duplicates;
        }, []);

      // lookup table by page refs
      const pageMetricsDict = arrayToDictionary(
        pageMetricsToMatch,
        'page',
        true,
      );

      // lookup table by url for duplicates
      const pageMetricsUrlDict = arrayToDictionary(pageMetricsToMatch, 'url');

      const bulkWriteOps: AnyBulkWriteOperation<PageMetrics>[] = [];

      // will be easier to do if we separate with dups from without dups
      const searchResultsWithoutDups = resultsWithRefs.filter(
        ({ page }) => !duplicateSearchTermPageRefs.includes(page),
      );

      const searchResultsWithDups = resultsWithRefs.filter(({ page }) =>
        duplicateSearchTermPageRefs.includes(page),
      );

      // And... bare with me here...
      // Separating dups between dups in searchTerms/dups in both

      // Refs are duplicated in search results only:
      const searchResultsWithSearchDups = searchResultsWithDups.filter(
        ({ page }) => !duplicatePageMetricsPageRefs.includes(page),
      );

      // Refs are duplicated in both:
      const searchResultsWithDupsInBoth = searchResultsWithDups.filter(
        ({ page }) => duplicatePageMetricsPageRefs.includes(page),
      );

      // possible "duplicated page ref" scenarios:
      // search duplicated + metrics duplicated -> try match urls; ignore if no match
      // search duplicated only                 -> update metrics doc w/ merged results
      // metrics duplicated only                -> try match urls; update whichever one "at random"

      // OTHERWISE (no dups) -> match refs and be done with it

      // if dups in both: try matching urls and ignore otherwise
      for (const searchTermResults of searchResultsWithDupsInBoth) {
        const pageMetricsMatch = pageMetricsUrlDict[searchTermResults.cleanUrl];

        if (pageMetricsMatch) {
          bulkWriteOps.push({
            updateOne: {
              filter: { _id: pageMetricsMatch._id },
              update: {
                $set: {
                  aa_searchterms: searchTermResults.aa_searchterms,
                },
              },
            },
          });
        }
      }

      // if dups in search results only: merge results and update matching pageMetrics

      // first, merge results that have the same Page ref
      const mergedDupResults: Record<
        string,
        { page: Types.ObjectId; aa_searchterms: AASearchTermMetrics[] }
      > = searchResultsWithSearchDups.reduce((mergedResults, searchResults) => {
        const mergedSearchResults: {
          aa_searchterms: AASearchTermMetrics[];
        } = mergedResults[`${searchResults.page}`];

        if (!mergedSearchResults) {
          mergedResults[`${searchResults.page}`] = {
            page: searchResults.page,
            aa_searchterms: searchResults.aa_searchterms,
          };

          return mergedResults;
        }

        mergedSearchResults.aa_searchterms.push(
          ...searchResults.aa_searchterms,
        );
        mergedSearchResults.aa_searchterms.sort((a, b) => a.clicks - b.clicks);

        return mergedResults;
      }, {});

      for (const searchTermResults of Object.values(mergedDupResults)) {
        const pageMetricsMatch = pageMetricsDict[`${searchTermResults.page}`];

        if (pageMetricsMatch) {
          bulkWriteOps.push({
            updateOne: {
              filter: { _id: pageMetricsMatch._id },
              update: {
                $set: {
                  aa_searchterms: searchTermResults.aa_searchterms,
                },
              },
            },
          });
        } else {
          this.logger.warn(
            chalk.yellowBright(
              `Found no page_metrics matches for page ref: ${searchTermResults.page}`,
            ),
          );
        }
      }

      // Now we're done with duplicates on the searchTerms side, so now we can do the "regular" loop
      // Because we're using arrayToDictionary with the "allowDuplicateKeys" option, we can just use whatever
      // page_metrics document ended up in the dictionary if page_metrics page ref is a duplicate
      for (const searchTermResults of searchResultsWithoutDups as SearchTermIntermediateResult[]) {
        const pageMetricsMatch = pageMetricsDict[`${searchTermResults.page}`];

        if (pageMetricsMatch) {
          bulkWriteOps.push({
            updateOne: {
              filter: { _id: pageMetricsMatch._id },
              update: {
                $set: {
                  aa_searchterms: searchTermResults.aa_searchterms,
                },
              },
            },
          });
        } else {
          this.logger.warn(
            chalk.yellowBright(
              'Found no page_metrics matches for search term results: ' +
                searchTermResults.cleanUrl,
            ),
          );

          noMetricsMatchSet.add({
            url: searchTermResults.cleanUrl,
            page: searchTermResults.page,
          });
        }
      }

      console.log('bulkWriteOps.length:');
      console.log(bulkWriteOps.length);

      const bulkWriteResults = await this.db.collections.pageMetrics.bulkWrite(
        bulkWriteOps,
        {
          ordered: false,
        },
      );

      this.logger.log('searchTerm bulkWrite results:');
      logJson(bulkWriteResults);

      if (noMetricsMatchSet.size > 0) {
        const dateString = dateRange.start.slice(0, 10);
        const logFilename = `searchterms-noMatch-${dateString}.json`;

        await writeLogFile(logFilename, [...noMetricsMatchSet]);
      }
    }
  }
}
