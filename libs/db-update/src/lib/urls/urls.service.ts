import { Inject, Injectable, Optional } from '@nestjs/common';
import * as cheerio from 'cheerio/slim';
import dayjs from 'dayjs';
import { minify } from 'html-minifier-terser';
import { type FilterQuery, Types, type AnyBulkWriteOperation } from 'mongoose';
import { filter, mapObject, omit, pick, pipe } from 'rambdax';
import {
  BlobStorageService,
  type IStorageModel,
  type S3Bucket,
} from '@dua-upd/blob-storage';
import { DbService, Page, Readability, Url } from '@dua-upd/db';
import { BlobLogger } from '@dua-upd/logger';
import { md5Hash } from '@dua-upd/node-utils';
import type { IPage, IUrl, UrlHash } from '@dua-upd/types-common';
import {
  arrayToDictionary,
  collapseStrings,
  HttpClient,
  HttpClientResponse,
  prettyJson,
  squishTrim,
  today,
  wait,
} from '@dua-upd/utils-common';
import { ReadabilityService } from '../readability/readability.service';
import { createUpdateQueue } from '../utils';
import { DuckDbService, type HtmlSnapshot } from '@dua-upd/duckdb';
import { sql } from 'drizzle-orm';
import { assert } from 'node:console';
import type { ContainerClient } from '@azure/storage-blob';

export type UpdateUrlsOptions = {
  urls?: {
    check404s?: boolean;
    checkAll?: boolean;
    filter?: FilterQuery<Page>;
  };
};

@Injectable()
export class UrlsService {
  private readonly DATA_BLOB_NAME = 'urls-collection-data.json';
  private readonly READABILITY_BLOB_NAME = 'readability-collection-data.json';
  private readonly urlsBlob: IStorageModel<S3Bucket | ContainerClient>;

  private rateLimitStats = true;
  private readonly http = new HttpClient({
    logger: this.logger,
    rateLimitStats: this.rateLimitStats,
    rateLimitDelay: 101,
    batchSize: 10,
  });

  constructor(
    private db: DbService,
    @Inject('DB_UPDATE_LOGGER') private logger: BlobLogger,
    @Inject(BlobStorageService.name) private blobService: BlobStorageService,
    @Inject('ENV') private production: boolean,
    @Inject(DuckDbService.name) private duckDb: DuckDbService,
    @Optional() private readability: ReadabilityService,
  ) {
    assert(this.blobService.blobModels.urls, 'Urls blob model not found');
    this.urlsBlob = this.blobService.blobModels.urls!;
  }

  private async getBlobClient() {
    return this.urlsBlob.blob(this.DATA_BLOB_NAME);
  }

  private async getArchiveBlobClient() {
    const dateString = new Date().toISOString().slice(0, 10);

    return this.urlsBlob.blob(`archive/${dateString}/${this.DATA_BLOB_NAME}`);
  }

  private async getReadabilityBlobClient() {
    return this.urlsBlob.blob(this.READABILITY_BLOB_NAME);
  }

  private async preparePagesCollection() {
    // We mostly just want to make sure that Pages don't have "duplicated" urls
    // specifically, cases where two versions of a url exist,
    // one with "https://" and one without.

    const pagesToUpdate = await this.db.collections.pages
      .find({ url: /^\s*https:|\s+$/i }, { url: 1 })
      .lean()
      .exec();

    const httpsRegex = new RegExp('https?://', 'ig');

    const updateOps: AnyBulkWriteOperation<Page>[] = pagesToUpdate.map(
      (page) => ({
        updateOne: {
          filter: { _id: page._id },
          update: {
            $set: { url: squishTrim(page.url).replace(httpsRegex, '') },
          },
        },
      }),
    );

    await this.db.collections.pages.bulkWrite(updateOps);
  }

  async updateCollectionFromBlobStorage() {
    this.logger.setContext(UrlsService.name);

    try {
      const blobClient = await this.getBlobClient();

      if (!(await blobClient.exists())) {
        this.logger.warn(
          `Tried to sync local Urls collection, but data blob does not exist.`,
        );
        return;
      }

      const blobProperties = await blobClient.getProperties();

      const blobDate = blobProperties.metadata?.date
        ? new Date(blobProperties.metadata.date)
        : blobProperties.lastModified;

      const collectionDate = (
        await this.db.collections.urls
          .findOne({}, { last_checked: 1 }, { sort: { last_checked: -1 } })
          .lean()
          .exec()
      )?.last_checked;

      if (
        collectionDate &&
        dayjs(collectionDate).add(1, 'day').isAfter(blobDate)
      ) {
        this.logger.log(`Collection data is up to date.`);
        return;
      }

      this.logger.log(`Downloading collection data from blob storage...`);

      const blobData = await blobClient.downloadToString();

      if (!blobData) {
        this.logger.warn(`No data found in blob storage.`);
        return;
      }

      this.logger.log(`Inserting data into collection...`);

      const jsonReviver = (key, value) => {
        if (key === 'last_checked' || key === 'last_updated') {
          return new Date(value);
        }

        if (key === '_id' || key === 'page') {
          return new Types.ObjectId(value);
        }

        if (key === 'hashes') {
          return value.map((hash) => ({
            ...hash,
            date: new Date(hash.date),
          }));
        }

        return value;
      };

      const bulkWriteOps: AnyBulkWriteOperation<Url>[] = JSON.parse(
        blobData,
        jsonReviver,
      ).map((url: IUrl) => ({
        updateOne: {
          filter: { url: url.url },
          update: {
            $setOnInsert: {
              _id: url._id,
            },
            $set: omit(['_id'], url),
          },
          upsert: true,
        },
      }));

      const bulkWriteResults = await this.db.collections.urls.bulkWrite(
        bulkWriteOps,
        { ordered: true },
      );

      this.logger.accent(
        `${
          bulkWriteResults.modifiedCount + bulkWriteResults.upsertedCount
        } urls updated.`,
      );

      this.logger.log(`Urls collection successfully updated.`);
    } catch (err) {
      this.logger.error('Error updating urls collection from blob storage:');
      this.logger.error(err.stack);
    }

    await this.ensurePageRefs();

    this.logger.resetContext();
  }

  async updateUrls(options?: UpdateUrlsOptions) {
    if (
      options?.urls?.filter &&
      (options?.urls?.check404s || options?.urls?.checkAll)
    ) {
      throw new Error(
        'Cannot use filter option with check404s or checkAll options.',
      );
    }

    await this.preparePagesCollection();

    if (!this.production) {
      await this.updateCollectionFromBlobStorage();
      // await this.readability.updateCollectionFromBlobStorage();

      return;
    }

    await this.updateCollectionFromPageUrls();

    this.logger.info('Checking Urls collection to see what URLs to update.');

    const threeDaysAgo = today().subtract(3, 'days').add(2, 'hours').toDate();
    const fourDaysAgo = today().subtract(4, 'days').add(2, 'hours').toDate();

    const ignoredUrls = [
      // Search pages seem to be blocked
      'www.canada.ca/en/revenue-agency/search/advanced-search.html',
      'www.canada.ca/fr/agence-revenu/rechercher/recherche-avancee.html',
      'www.canada.ca/en/revenue-agency/search.html',
      'www.canada.ca/fr/agence-revenu/rechercher.html',
      // URLs below seem to have an endless redirect loop
      'www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/completing-filing-information-returns/t4a-information-payers/t4a-slip/distribute-your-t4a-slips.html',
      'www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/retenues-paie/remplir-produire-declarations-renseignements/t4a-information-payeurs/feuillet-t4a/comment-distribuer-vos-feuillets-t4a.html',
    ];

    const filter404s = options?.urls?.check404s
      ? {}
      : {
          is_404: {
            $in: [null, false],
          },
        };

    const urlsQuery =
      options?.urls?.filter || options?.urls?.checkAll
        ? {}
        : {
            url: /^www\.canada\.ca/,
            $or: [
              { last_checked: null },
              {
                ...filter404s,
                last_checked: { $lt: threeDaysAgo },
              },
              {
                is_404: true,
                last_checked: { $lt: fourDaysAgo },
              },
            ],
          };

    const urlsFromCollection = (
      await this.db.collections.urls.find(urlsQuery).lean().exec()
    ).filter(
      // filter out pages that have an endless redirect loop (and pdfs)
      (urlDoc) =>
        !ignoredUrls.includes(urlDoc.url) && !urlDoc.url.endsWith('.pdf'),
    );

    if (urlsFromCollection?.length) {
      this.logger.info(
        `Found ${urlsFromCollection.length} URLs from collection to check.`,
      );

      return await this.checkAndUpdateUrlData(urlsFromCollection);
    }

    // check whether everything is up to date, or if collection is empty
    const anyUrlDoc = await this.db.collections.urls.findOne({}).lean().exec();

    if (anyUrlDoc) {
      this.logger.info('URL data is already up to date.');

      return;
    }

    throw new Error(
      'Urls collection should be populated, but no data was found.',
    );
  }

  private async assessReadability(
    content: string,
    metadata: { url: string; page: Types.ObjectId; hash: string; date: Date },
  ): Promise<Readability> {
    const langRegex = /canada\.ca\/(en|fr)/i;
    const lang = langRegex.exec(metadata.url)?.[1];

    if (!lang || (lang !== 'en' && lang !== 'fr')) {
      throw new Error(`Could not determine language for ${metadata.url}`);
    }

    const readabilityScore = this.readability.calculateReadability(
      content,
      lang,
    );

    return {
      _id: new Types.ObjectId(),
      lang,
      ...metadata,
      ...readabilityScore,
    };
  }

  private async checkAndUpdateUrlData(urls: Url[]) {
    const urlsDataDict = arrayToDictionary(urls, 'url');

    const pageUrls = await this.db.collections.pages
      .find({}, { url: 1 })
      .lean()
      .exec();

    const urlsPageDict = arrayToDictionary(pageUrls, 'url');

    const existingReadabilityHashes = (
      await this.db.collections.readability
        .aggregate<{ _id: string }>()
        .project({ hash: 1 })
        .group({ _id: '$hash' })
        .exec()
    ).map(({ _id }) => _id);

    const urlsParquetUpdateQueue: HtmlSnapshot[] = [];

    // using an update queue to batch updates rather than flooding the db with requests
    const urlsQueue = createUpdateQueue<AnyBulkWriteOperation<Url>>(
      100,
      async (ops) => {
        await this.db.collections.urls.bulkWrite(ops);
      },
    );

    const readabilityQueue = createUpdateQueue<Readability>(
      100,
      async (ops) => {
        await this.db.collections.readability.insertMany(ops, { lean: true });
      },
    );

    const flushQueues = async () => {
      await Promise.all([urlsQueue.flush(), readabilityQueue.flush()]);
    };

    const addToQueues = async (
      urlData: Url & { hash?: UrlHash },
      readabilityScore?: Readability,
    ) => {
      if (readabilityScore) {
        await readabilityQueue.add(readabilityScore);
      }

      if (!urlData.hash) {
        const updateOp: AnyBulkWriteOperation<Url> = {
          updateOne: {
            filter: {
              _id: urlData._id,
            },
            update: {
              $setOnInsert: pick(['_id', 'url'], urlData),
              $set: omit(['_id', 'url'], urlData),
              upsert: true,
            },
          },
        };

        await urlsQueue.add(updateOp);

        return;
      }

      const updateOp: AnyBulkWriteOperation<Url> = {
        updateOne: {
          filter: {
            _id: urlData._id,
          },
          update: {
            $setOnInsert: pick(['_id', 'url'], urlData),
            $set: omit(['_id', 'url', 'hash', 'links'], urlData),
            $addToSet: {
              hashes: urlData.hash,
              links: {
                $each: urlData.links,
              },
              all_titles: urlData.title,
            },
          },
          upsert: true,
        },
      };

      await urlsQueue.add(updateOp);
    };

    try {
      await this.http.getAll(
        urls.map(({ url }) => url),
        async (response: HttpClientResponse) => {
          const date = new Date();

          const collectionData = urlsDataDict[response.url];

          if (!collectionData) {
            throw new Error(
              `No collection data found for url ${response.url}.`,
            );
          }

          const redirect = response.redirect
            ? { redirect: response.redirect }
            : {};

          if (response.is404) {
            return await addToQueues({
              _id: collectionData._id,
              url: collectionData.url,
              last_checked: date,
              last_modified: date,
              is_404: true,
              ...redirect,
            });
          }

          // this means it was rate limited, so just ignore it, and it'll be checked again later
          if (response.title === 'Access Denied') {
            return;
          }

          const processedHtml = processHtml(response.body || '');

          if (!processedHtml) {
            return await addToQueues({
              _id: collectionData._id,
              url: collectionData.url,
              last_checked: date,
              last_modified: date,
              // if the body is empty, it's technically not a 404, but may as well be.
              is_404: true,
              ...redirect,
            });
          }

          const langHrefs = processedHtml.langHrefs
            ? { langHrefs: processedHtml.langHrefs }
            : {};

          // need to hash the processed html because of dynamically injected content
          const hash = md5Hash(processedHtml.body);

          const readabilityMetadata = {
            url: collectionData.url,
            page: collectionData.page,
            hash,
            date,
          };

          const urlBlob = this.urlsBlob.blob(hash);

          // if blob already exists, add the url to its blob metadata if it's not already there
          if (await urlBlob.exists()) {
            const blobMetadata = (await urlBlob.getProperties()).metadata;
            const urls: string[] = blobMetadata
              ? JSON.parse(blobMetadata.urls)
              : [];

            if (!urls.includes(response.url)) {
              urls.push(response.url);

              await urlBlob.setMetadata({
                ...blobMetadata,
                urls: JSON.stringify(urls),
              });
            }
          } else {
            try {
              // if html is malformed, minifying will fail.
              // we'll wrap it in a try/catch and upload it as-is if that happens
              const minifiedBody: string = await minify(processedHtml.body, {
                collapseWhitespace: true,
                conservativeCollapse: true,
                continueOnParseError: true,
                minifyCSS: true,
                minifyJS: true,
                removeComments: true,
                sortAttributes: true,
                sortClassName: true,
              });

              await urlBlob.uploadFromString(minifiedBody, {
                metadata: {
                  urls: JSON.stringify([response.url]),
                  date: date.toISOString(),
                },
              });

              urlsParquetUpdateQueue.push({
                url: collectionData.url,
                page: collectionData.page?.toString() || null,
                hash,
                html: minifiedBody,
                date,
              });
            } catch (err) {
              // If an error is caught here, it could either be because minifying failed,
              // or because the blob was uploaded from a "redirect" url after we
              // checked if it exists.

              if (/already exists/.test(err.message)) {
                // if already exists, set blob metadata like above
                const blobMetadata = (await urlBlob.getProperties()).metadata;

                const urls: string[] = blobMetadata
                  ? JSON.parse(blobMetadata.urls)
                  : [];

                if (!urls.includes(response.url)) {
                  urls.push(response.url);

                  await urlBlob.setMetadata({
                    ...blobMetadata,
                    urls: JSON.stringify(urls),
                  });
                }
              } else {
                await urlBlob.uploadFromString(processedHtml.body, {
                  metadata: {
                    urls: JSON.stringify([response.url]),
                    date: date.toISOString(),
                  },
                });

                urlsParquetUpdateQueue.push({
                  url: collectionData.url,
                  page: collectionData.page?.toString() || null,
                  hash,
                  html: processedHtml.body,
                  date,
                });
              }
            }
          }

          if (
            collectionData?.hashes &&
            collectionData.hashes.map(({ hash }) => hash).includes(hash)
          ) {
            // current hash has already been saved previously -- can skip
            // (just update last_checked in db)
            try {
              // assess readability if data does not exist for this hash
              if (!existingReadabilityHashes.includes(hash)) {
                if (!readabilityMetadata.page) {
                  this.logger.warn(
                    `Page ref not found for url ${response.url}, skipping readability assessment.`,
                  );
                }

                const readabilityScore = readabilityMetadata.page
                  ? await this.assessReadability(
                      processedHtml.body,
                      readabilityMetadata as {
                        url: string;
                        page: Types.ObjectId;
                        hash: string;
                        date: Date;
                      },
                    )
                  : undefined;

                return await addToQueues(
                  {
                    _id: collectionData._id,
                    url: collectionData.url,
                    title: processedHtml.title,
                    last_checked: date,
                    metadata: processedHtml.metadata,
                    ...langHrefs,
                    links: processedHtml.links,
                    ...redirect,
                  },
                  readabilityScore,
                );
              }

              return await addToQueues({
                _id: collectionData._id,
                url: collectionData.url,
                title: processedHtml.title,
                last_checked: date,
                metadata: processedHtml.metadata,
                ...langHrefs,
                links: processedHtml.links,
                ...redirect,
              });
            } catch (err) {
              this.logger.error(
                'Error updating Url collection data or assessing readability:',
              );
              this.logger.error(err.stack);
              return;
            }
          }

          try {
            const page = urlsPageDict[response.url]
              ? { page: urlsPageDict[response.url]._id }
              : {};

            if (!readabilityMetadata.page) {
              this.logger.warn(
                `Page ref not found for url ${response.url}, skipping readability assessment.`,
              );
            }

            const readabilityScore = readabilityMetadata.page
              ? await this.assessReadability(
                  processedHtml.body,
                  readabilityMetadata as {
                    url: string;
                    page: Types.ObjectId;
                    hash: string;
                    date: Date;
                  },
                )
              : undefined;

            return await addToQueues(
              {
                _id: collectionData._id,
                url: response.url,
                title: processedHtml.title,
                ...page,
                metadata: processedHtml.metadata,
                ...langHrefs,
                links: processedHtml.links,
                ...redirect,
                last_checked: date,
                last_modified: date,
                is_404: false,
                hash: { hash, date },
                latest_snapshot: hash,
              },
              readabilityScore,
            );
          } catch (err) {
            this.logger.error(
              `An error occurred when inserting Url data to db for url:\n${response.url}\n`,
            );

            if (/cheerio/.test(err.message) && !response.body) {
              this.logger.error(
                `Cheerio loading error. Response body is empty!`,
              );
            } else if (/cheerio/.test(err.message)) {
              this.logger.error(
                `Cheerio loading error but response body is not empty.`,
              );
              this.logger.error(err);
            } else {
              this.logger.error(err.stack);
            }
          }
        },
        true,
      );
    } catch (err) {
      this.logger.error('An error occurred during http.getAll():');
      this.logger.error(err.stack);
    } finally {
      // commit any remaining updates
      await flushQueues();
    }

    try {
      await this.syncDataWithPages();
    } catch (err) {
      this.logger.error(
        'An error occurred while syncing urls data with pages:',
      );
      this.logger.error(err);
    }

    try {
      await this.saveCollectionToBlobStorage();
    } catch (err) {
      this.logger.error(
        'An error occurred during saveCollectionToBlobStorage():',
      );
      this.logger.error(err);
    }

    try {
      await this.readability.saveCollectionToBlobStorage();
    } catch (err) {
      this.logger.error(
        'An error occurred during readability.saveCollectionToBlobStorage():',
      );
      this.logger.error(err);
    }

    try {
      await this.updateRemoteParquet(urlsParquetUpdateQueue);
    } catch (err) {
      this.logger.error('An error occurred during updateRemoteParquet():');
      this.logger.error(err);
    }

    this.logger.info('Urls and Readability updates completed.');
  }

  async getPageData(url: string) {
    const rateLimitStatsSetting = this.rateLimitStats;

    this.http.setRateLimitStats(false);

    try {
      const response = await this.http.get(url);

      const lang = /^www\.canada\.ca\/(en|fr)/.exec(url)?.[1];

      const redirect = response.redirect ? { redirect: response.redirect } : {};

      if (response.title === 'Access Denied') {
        throw Error('Tried to get page data but received "Access Denied"');
      }

      const processedHtml = processHtml(response.body || '');

      if (!processedHtml) {
        throw Error('Tried to get page data but body was empty');
      }

      // need to hash the processed html because of dynamically injected content
      const hash = md5Hash(processedHtml.body);

      return {
        ...response,
        processedHtml,
        redirect,
        hash,
        lang,
      };
    } catch (err) {
      this.logger.error(`Error getting page data for url: ${url}`);
      this.logger.error(err);
    } finally {
      this.http.setRateLimitStats(rateLimitStatsSetting);
    }
  }

  async populateEmptyTitles() {
    const urlsNoTitle = await this.db.collections.urls
      .find(
        { $or: [{ title: '' }, { title: null }] },
        { url: 1, title: 1, page: 1 },
      )
      .lean()
      .exec();

    if (urlsNoTitle.length === 0) {
      this.logger.log('All urls have titles.');

      return;
    }

    const noTitleUrls = urlsNoTitle.map(({ url }) => url);

    const urlsTitlesMap = await this.urlsBlob
      .blob('all-titles.json')
      .downloadToString()
      .then(
        pipe(
          JSON.parse,
          filter((titles, url) => noTitleUrls.includes(url)),
          mapObject(collapseStrings),
        ),
      );

    const titlesFromPagesMap = await this.urlsBlob
      .blob('titles-from-pages.json')
      .downloadToString()
      .then(JSON.parse);

    this.logger.log(`${urlsNoTitle.length} urls with no title`);

    const urlsNoTitleMatch = urlsNoTitle.filter(
      (url) => !urlsTitlesMap[url.url],
    );

    this.logger.log(
      `${urlsNoTitleMatch.length} urls with no title match - will use titles from Pages`,
    );

    // get titles from pages if no match
    const noMatchWithPageTitles = urlsNoTitleMatch
      .filter((url) => titlesFromPagesMap[url.url])
      .map((url) => ({
        ...url,
        title: squishTrim(titlesFromPagesMap[url.url] as string),
      }));

    this.logger.log(
      `${noMatchWithPageTitles.length} urls with no title match but with title from Pages`,
    );

    const urlsWithTitleMatch = urlsNoTitle
      .filter((url) => urlsTitlesMap[url.url]?.length > 0)
      .map((url) => ({
        ...url,
        title: urlsTitlesMap[url.url][0],
      }));

    this.logger.log(`${urlsWithTitleMatch.length} urls with title matches:`);

    const bulkWriteOps: AnyBulkWriteOperation<Url>[] = [
      ...urlsWithTitleMatch,
      ...noMatchWithPageTitles,
    ].map(({ _id, title }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { title } },
      },
    }));

    const bulkWriteResults =
      await this.db.collections.urls.bulkWrite(bulkWriteOps);

    this.logger.log(`updated ${bulkWriteResults.modifiedCount} url titles`);
  }

  async syncDataWithPages() {
    await this.populateEmptyTitles();
    await this.ensurePageRefs();

    const urlsWithPages = (
      await this.db.collections.urls
        .aggregate<{
          _id: Types.ObjectId;
          url: string;
          title: string;
          redirect?: string;
          is_404?: boolean;
          metadata?: { [prop: string]: string | Date };
          page: IPage;
          langHrefs?: {
            en?: string;
            fr?: string;
            [prop: string]: string | undefined;
          };
        }>()
        .project({
          url: 1,
          title: 1,
          redirect: 1,
          is_404: 1,
          metadata: 1,
          page: 1,
          langHrefs: 1,
        })
        .match({
          page: { $exists: true },
          // ignoring urls with no titles
          $and: [{ title: { $ne: null } }, { title: { $ne: '' } }],
        })
        .lookup({
          from: 'pages',
          localField: 'page',
          foreignField: '_id',
          as: 'page',
        })
        .unwind('page')
        .exec()
    ).map((url) => {
      const lang = /^www\.canada\.ca\/(en|fr)/.exec(url.url)?.[1];
      const altLang = lang === 'en' ? 'fr' : 'en';

      const altLangHref =
        altLang && url.langHrefs?.[altLang]
          ? { altLangHref: url.langHrefs[altLang] }
          : {};

      return {
        ...omit(['langHrefs'], url),
        ...altLangHref,
      };
    });

    const pickUrlsProps = pick([
      'title',
      'altLangHref',
      'redirect',
      'is_404',
      'metadata',
    ]);

    const toComparisonString = pipe(pickUrlsProps, JSON.stringify);

    const pagesToUpdate = urlsWithPages.filter(
      (urlDoc) =>
        toComparisonString(urlDoc) !== toComparisonString(urlDoc.page),
    );

    if (!pagesToUpdate.length) {
      this.logger.info('Pages are up-to-date');

      return;
    }

    const pageWriteOps: AnyBulkWriteOperation<Page>[] = pagesToUpdate.map(
      (url) => ({
        updateOne: {
          filter: { _id: url.page._id },
          update: {
            $set: pickUrlsProps(url),
          },
        },
      }),
    );

    if (!pageWriteOps.length) {
      this.logger.info('Pages are up-to-date');

      return;
    }

    this.logger.info(`Updating ${pageWriteOps.length} pages...`);

    const bulkWriteResults =
      await this.db.collections.pages.bulkWrite(pageWriteOps);

    this.logger.info(`Updated ${bulkWriteResults.modifiedCount} pages`);
  }

  private async updateCollectionFromPageUrls() {
    this.logger.info('Checking Pages collection for any new urls...');

    const currentUrls =
      (await this.db.collections.urls.distinct<string>('url').exec()) || [];

    const pageUrls = await this.db.collections.pages
      .find({}, { url: 1 })
      .lean()
      .exec();

    if (!pageUrls?.length) {
      throw new Error(
        'Could not populate urls collection. The pages collection seems to be empty.',
      );
    }

    const urlDocs: Url[] = pageUrls
      .filter((page) => !currentUrls.includes(page.url))
      .map((page) => ({
        _id: new Types.ObjectId(),
        url: page.url,
        page: page._id,
      }));

    if (!urlDocs.length) {
      this.logger.log(`No new urls found.`);

      return;
    }

    await this.db.collections.urls.insertMany(urlDocs);

    this.logger.log(`${urlDocs.length} new urls added.`);

    await this.ensurePageRefs();
  }

  async saveCollectionToBlobStorage(force = false) {
    this.logger.info('Saving urls data to blob storage...');

    try {
      const blobClient = await this.getBlobClient();

      if (await blobClient.exists()) {
        const date = new Date((await blobClient.getProperties()).metadata?.date || '1970-01-01');

        const newData = await this.db.collections.urls
          .findOne({ last_modified: { $gt: date } })
          .lean()
          .exec();

        if (!newData && !force) {
          this.logger.log('No new data added. Skipping upload to storage.');

          return;
        }

        this.logger.accent(
          `Overwriting url data from date: ${date.toISOString()}`,
        );
      }

      const data = await this.db.collections.urls.find().lean().exec();

      const newDate = new Date();

      await blobClient.uploadFromString(JSON.stringify(data), {
        metadata: { date: newDate.toISOString() },
        overwrite: true,
      });

      const archiveClient = await this.getArchiveBlobClient();

      if (!(await archiveClient.exists())) {
        await archiveClient.uploadFromString(JSON.stringify(data));
      }
    } catch (err) {
      this.logger.error(
        `An error occurred uploading collection to blob storage:`,
      );
      this.logger.error(err.stack);
    }
  }

  async ensurePageRefs() {
    this.logger.info('Ensuring page refs for urls collection...');

    const urlsWithPages = await this.db.collections.urls
      .aggregate<{ _id: Types.ObjectId; url: string; page?: [IPage] }>()
      .project({ url: 1, page: 1 })
      .match({ page: { $exists: true } })
      .lookup({
        from: 'pages',
        localField: 'page',
        foreignField: '_id',
        as: 'page',
      })
      .exec();

    const urlsToUpdate = urlsWithPages
      .filter(
        (urlDoc) => !urlDoc.page?.length || urlDoc.page[0]?.url !== urlDoc.url,
      )
      .map(({ url }) => url);

    if (!urlsToUpdate.length) {
      this.logger.info('Pages references are up to date.');

      return;
    }

    const pagesForUpdates = await this.db.collections.pages
      .find({ url: { $in: urlsToUpdate } }, { url: 1 })
      .lean()
      .exec();

    if (!pagesForUpdates.length) {
      this.logger.error(
        `Invalid references found, but no corresponding pages were found for urls: ${prettyJson(
          urlsToUpdate,
        )}`,
      );

      return;
    }

    const bulkWriteOps: AnyBulkWriteOperation<IUrl>[] = pagesForUpdates.map(
      (page) => ({
        updateOne: {
          filter: { url: page.url },
          update: {
            $set: { page: page._id },
          },
        },
      }),
    );

    this.logger.log(
      `Updating references to ${pagesForUpdates.length} pages...`,
    );

    await this.db.collections.urls.bulkWrite(bulkWriteOps);

    this.logger.info('Page references successfully updated.');

    return;
  }

  async updateRemoteParquet(snapshots: HtmlSnapshot[]) {
    if (!snapshots?.length) {
      this.logger.info('No new snapshots, skipping parquet update.');

      return;
    }

    const htmlTable = this.duckDb.remote.html;

    await htmlTable.backupRemote();
    await htmlTable.createLocalTable();
    await htmlTable.insertLocal(snapshots);

    await htmlTable.appendLocalToRemote({
      rowGroupSize: 10000,
      compressionLevel: 7,
    });

    // clear data and free memory
    await htmlTable.deleteLocalTable();
  }

  async syncRemoteParquet(runBackup = true) {
    this.logger.info('Syncing remote parquet...');
    console.time('syncRemoteParquet time');

    const htmlTable = this.duckDb.remote.html;

    console.time('mongo fetch time');
    const dbHashes = await this.db.collections.urls
      .aggregate<{ hashes: string }>()
      .project({ hashes: '$hashes.hash' })
      .unwind('hashes')
      .exec()
      .then((hashes) => hashes.map(({ hashes }) => `'${hashes}'`).join(','));

    console.timeEnd('mongo fetch time');

    const dbHashesSql = sql.raw(`unnest([${dbHashes}]) db(hash)`);

    const differenceSql = sql`
      SELECT * from ${dbHashesSql}
      EXCEPT
      ${htmlTable.selectRemote({ hash: htmlTable.table.hash })}
    `;

    console.time('Missing hashes query time');
    const missingHashes = await this.duckDb.db
      .execute(differenceSql)
      .then((rows) => rows.map(({ hash }) => hash));
    console.timeEnd('Missing hashes query time');

    if (missingHashes.length === 0) {
      this.logger.info(
        'No missing hashes found in parquet file, skipping updates.',
      );

      return;
    }

    runBackup && (await htmlTable.backupRemote());
    await htmlTable.createLocalTable();

    const missingHashDocs = (
      await this.db.collections.urls
        .find(
          { 'hashes.hash': { $in: missingHashes } },
          { url: 1, page: 1, hashes: 1 },
        )
        .lean()
        .exec()
    ).flatMap((urlDoc) =>
    (urlDoc.hashes || [])
        .filter((hashDoc) => missingHashes.includes(hashDoc.hash))
        .map((hashDoc) => ({
          url: urlDoc.url,
          page: urlDoc.page?.toString() || null,
          hash: hashDoc.hash,
          date: hashDoc.date,
        })),
    );

    console.log(`Found ${missingHashDocs.length} missing hashes`);

    const promises: Promise<{
      url: string;
      page: string | null;
      hash: string;
      html: string | null;
      date: Date;
    } | null>[] = [];

    console.time('HTML blob download time');
    for (const hashDoc of missingHashDocs) {
      const promise = this.urlsBlob
        .blob(hashDoc.hash)
        .downloadToString({ decompressData: true })
        .then((html) => ({
          ...hashDoc,
          html: html || null,
        }))
        .catch((err) => {
          this.logger.error(`Error occurred downloading html blob:`);
          this.logger.error(err);

          return null;
        });

      promises.push(promise);

      await wait(20);
    }

    const rowsToInsert = (await Promise.allSettled(promises))
      .map((result) => {
        if (result.status === 'rejected') {
          this.logger.error(`Error occurred downloading html blob:`);
          this.logger.error(result.reason);

          return null;
        }

        return result.value;
      })
      .filter((result) => result !== null);

    console.timeEnd('HTML blob download time');

    if (!rowsToInsert.length) {
      this.logger.info('No new rows to insert, skipping update.');

      return;
    }

    console.time('Local DuckDB insert time');
    await htmlTable.insertLocal(rowsToInsert);
    console.timeEnd('Local DuckDB insert time');

    console.time('Remote DuckDB append time');
    await htmlTable.appendLocalToRemote({
      rowGroupSize: 10000,
      compressionLevel: 7,
    });
    console.timeEnd('Remote DuckDB append time');

    // clear data and free memory
    await htmlTable.deleteLocalTable();

    this.logger.info('Sync process completed successfully.');
    console.timeEnd('syncRemoteParquet time');
  }
}

type ProcessedHtml = {
  title: string;
  body: string;
  metadata: Record<string, string>;
  links: { href: string; text: string }[];
  langHrefs: { [lang: string]: string };
};

export const processHtml = (html: string): ProcessedHtml | null => {
  const $ = cheerio.load(
    // remove part of dynamically generated attribute to avoid generating
    // a different hash for the same content
    html.replaceAll(/"details-elements-\d+"/g, '"details-elements-"'),
    {},
    false,
  );
  $('script, meta[property="fb:pages"]').remove();

  const body = $('main').html() || '';

  if (!body.trim()) {
    return null;
  }

  const metadata = Object.fromEntries(
    $('meta[name], meta[property]')
      .toArray()
      .filter(
        (meta) =>
          meta.attribs.name &&
          meta.attribs.content &&
          meta.attribs.content !== 'IE=edge' &&
          meta.attribs.content !== 'width=device-width,initial-scale=1',
      )
      .map((meta) => {
        if (
          ['dcterms.issued', 'dcterms.modified'].includes(meta.attribs.name) &&
          /\d{4}-\d{2}-\d{2}/.test(meta.attribs.content)
        ) {
          return [meta.attribs.name, new Date(meta.attribs.content)];
        }

        return [meta.attribs.name, meta.attribs.content];
      }),
  );

  const links = $('main a[href]')
    .toArray()
    .map((a) => ({
      href: a.attribs.href
        .replace('https://', '')
        .replace(/^\/(en|fr)\//i, 'www.canada.ca/$1/'),
      text: $(a).text(),
    }));

  const langHrefs = Object.fromEntries(
    $('link[rel="alternate"][hreflang]')
      .toArray()
      .filter((link) => link.attribs.hreflang && link.attribs.href)
      .map((link) => {
        const href = link.attribs.href
          .replace('https://', '')
          .replace(/(\.html)+$/i, '.html');

        return [link.attribs.hreflang, href];
      }),
  );

  return {
    title: $('title')
      .text()
      .replace(/ - Canada\.ca\s*$/, '')
      .replace(/[\t\n\s]+/g, ' ')
      .trim(),
    body: $.html(),
    metadata,
    links,
    langHrefs,
  };
};
