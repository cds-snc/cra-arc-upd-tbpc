/**
 *
 * MongoDB references:
 *
 * [CRUD Operations docs]{@link https://www.mongodb.com/docs/v4.4/crud/}
 *
 * [Aggregation pipeline explainer]{@link https://www.mongodb.com/docs/v4.4/core/aggregation-pipeline/}
 *
 * [Aggregation pipeline reference]{@link https://www.mongodb.com/docs/v4.4/reference/aggregation/}
 *
 * ***
 * For your scripts to be usable from the CLI, just make sure the file is
 * exported from index.ts.
 *
 * If the file is already exported, you just need to declare the function
 * (including the 'export' keyword) and it'll automatically be exported!
 *
 * That's it 😀
 *
 */

import { UrlsService } from '@dua-upd/db-update';
import { DbService } from '@dua-upd/db';
import { logJson } from '@dua-upd/utils-common';
import { RunScriptCommand } from '../../run-script.command';
import { outputChart, outputTable } from '../utils/output';
import { readFile } from 'fs/promises';
import {
  bytesToMbs,
  CompressionAlgorithm,
  compressString,
  decompressString,
} from '@dua-upd/node-utils';
import { startTimer } from '../utils/misc';
import {
  AdobeAnalyticsClient,
  createPageMetricsQuery,
} from '@dua-upd/external-data';
import {
  AdobeAnalyticsClient as AdobeAnalyticsClientNew,
  createQuery,
} from '@dua-upd/api/custom-reports';

/*
 * Simplest example, finds one document in pages_metrics and logs it
 */
export const logOneDocument = async (db: DbService) => {
  const results = await db.collections.pageMetrics
    .findOne({})
    .sort({ date: -1 });

  logJson(results);
};

/*
 * Fetch data and generate an HTML chart with it!
 */
export const outputAChart = async () => await outputChart('example-chart');

export const avgClicksBySearchTerm = async (db: DbService) => {
  const results = await db.collections.overall
    .aggregate()
    .project({ date: 1, aa_searchterms_en: 1 })
    .match({
      date: { $gte: new Date('2022-10-01'), $lte: new Date('2022-10-31') },
    })
    .unwind('$aa_searchterms_en')
    .group({
      _id: '$aa_searchterms_en.term',
      avg_clicks: {
        $avg: '$aa_searchterms_en.clicks',
      },
    })
    .sort({ avg_clicks: -1 })
    .limit(100);

  outputTable('results', results);
};

export const sumClicksBySearchTerm = async (db: DbService) => {
  const results = await db.collections.overall
    .aggregate()
    .project({ date: 1, aa_searchterms_en: 1 })
    .match({
      date: { $gte: new Date('2022-10-01'), $lte: new Date('2022-10-31') },
    })
    .unwind('$aa_searchterms_en')
    .group({
      _id: '$aa_searchterms_en.term',
      sum_clicks: {
        $sum: '$aa_searchterms_en.clicks',
      },
    })
    .sort({ sum_clicks: -1 })
    .limit(100);

  outputTable('results', results);
};

/*
 * Or maybe a table suits you better
 */
export const outputATable = async () =>
  await outputTable('example-table', [
    { col1: 'hi!', col2: 'sup?' },
    { col1: 'nm', col2: 'hbu?' },
  ]);

/*
 * Example of using an aggregation pipeline to group by page title and find duplicates
 */
export const findDuplicatedPageTitles = async (db: DbService) => {
  const results = await db.collections.pages // query the pages collection
    .aggregate() // use an aggregation pipeline
    .sort({ title: 1 }) // start by sorting documents by title so that the pipeline uses can use the index
    .group({
      _id: '$title', // group by title
      count: {
        $sum: 1, // count the number of instances
      },
    })
    .match({ count: { $gt: 1 } }) // only keep results with a count greater than 1
    .sort({ count: 1 })
    .exec();

  logJson(results);

  console.log(`${results.length} duplicated titles 😶`);
};

/*
 * Other stuff I've used to check data:
 */

export const findDuplicatedFirst255FromPublishedPages = async (
  db: DbService,
) => {
  const results = await db.collections.pagesList
    // The type params for the 'aggregate' call are to set the type
    //    of the pipeline output
    .aggregate<{ _id: string; count: number }>()
    // project only the first 255 chars of each url
    // (project meaning "what data is passed through the pipeline")
    .project({ _id: 0, url: { $substrBytes: ['$url', 0, 254] } })
    .sort({ url: 1 }) // sort it to make grouping faster
    .group({
      _id: '$url',
      count: {
        $sum: 1,
      },
    })
    .match({ count: { $gt: 1 } })
    .exec();

  const totalPageCount = results.reduce((total, page) => total + page.count, 0);

  const avgPagesPerUrl = totalPageCount / results.length;

  console.log(JSON.stringify(results, null, 2));

  console.log(`${results.length} duplicated (first 255 characters of) urls 😶`);
  console.log(`${totalPageCount} total pages w/ duplicated urls 😫`);
  console.log(`Average of ${avgPagesPerUrl} pages per duplicated url 🤮`);
};

export const getTopVisitsOfDups = async (db: DbService) => {
  const duplicates = await db.collections.pagesList
    .aggregate()
    .project({ _id: 0, url: 1, first255: { $substrBytes: ['$url', 0, 254] } })
    .sort({ first255: 1 }) // sort it to make grouping faster?
    .group({
      _id: '$first255',
      urls: {
        $addToSet: '$url',
      },
      count: {
        $sum: 1,
      },
    })
    .match({ count: { $gt: 1 } })
    .exec();

  const fullUrls = duplicates.map((page) => page.urls).flat();

  const pageIds = (
    await db.collections.pages.find({ url: { $in: fullUrls } }, { _id: 1 })
  ).map(({ _id }) => _id);

  console.log(`${pageIds.length} page ids`);

  const pageVisits = await db.collections.pageMetrics
    .aggregate()
    .project({ date: 1, url: 1, page: 1, visits: 1 })
    .match({
      date: { $gt: new Date('2022-04-01'), $lt: new Date('2022-06-15') },
      page: { $in: pageIds },
    })
    .group({
      _id: '$page',
      urls: {
        $addToSet: '$url',
      },
      visits: {
        $sum: '$visits',
      },
    })
    .sort({ visits: -1 })
    .exec();

  logJson(pageVisits);
};

/*
 * todo examples:
 *  -HttpClient
 *    -Get list of urls and return metadata + response status (404 or otherwise)
 *  -get data from db for analysis and export excel file
 */

export const getTopSearchTermPages = async (db: DbService) => {
  const dateRangeFilter = {
    date: {
      $gte: new Date('2022-11-20'),
      $lte: new Date('2022-11-26'),
    },
  };

  console.time('topSearchTerms');

  const topSearchTermsResults = await db.collections.overall
    .aggregate<{ _id: string; avg_clicks: number }>()
    .match(dateRangeFilter)
    .project({
      date: 1,
      aa_searchterms_en: 1,
    })
    .unwind('aa_searchterms_en')
    .project({
      date: 1,
      term: {
        $toLower: '$aa_searchterms_en.term',
      },
      clicks: '$aa_searchterms_en.clicks',
    })
    // first group terms that were different cases and take the sum of their clicks
    .group({
      _id: {
        date: '$date',
        term: '$term',
      },
      clicks: {
        $sum: '$clicks',
      },
    })
    .group({
      _id: '$_id.term',
      avg_clicks: {
        $avg: '$clicks',
      },
    })
    .sort({ avg_clicks: -1 })
    .limit(100)
    .exec();

  console.timeEnd('topSearchTerms');

  logJson(topSearchTermsResults);

  const topSearchTerms = topSearchTermsResults.map((result) => result._id);

  console.time('searchTermsWithUrlPositions');

  const searchTermsWithUrlPositions = await db.collections.pageMetrics
    .aggregate<{
      term: string;
      url_positions: { url: string; position: number }[];
    }>()
    .project({
      date: 1,
      url: 1,
      aa_searchterms: {
        $map: {
          input: '$aa_searchterms',
          as: 'searchterm',
          in: {
            term: {
              $toLower: '$$searchterm.term',
            },
            clicks: '$$searchterm.clicks',
            position: '$$searchterm.position',
          },
        },
      },
    })
    .match({
      ...dateRangeFilter,
      'aa_searchterms.term': {
        $in: topSearchTerms,
      },
    })
    .project({
      url: 1,
      aa_searchterms: {
        $filter: {
          input: '$aa_searchterms',
          as: 'searchterm',
          cond: {
            $in: ['$$searchterm.term', topSearchTerms],
          },
        },
      },
    })
    .unwind('aa_searchterms')
    .project({
      term: '$aa_searchterms.term',
      url: 1,
      position: '$aa_searchterms.position',
    })
    .group({
      _id: {
        term: '$term',
        url: '$url',
      },
      position: {
        $avg: '$position',
      },
    })
    .project({
      term: '$_id.term',
      url_position: {
        url: '$_id.url',
        position: '$position',
      },
    })
    .group({
      _id: '$term',
      url_positions: {
        $push: '$url_position',
      },
    })
    .project({ _id: 0, term: '$_id', url_positions: 1 })
    .exec();

  console.timeEnd('searchTermsWithUrlPositions');

  console.log(
    `Found results for ${searchTermsWithUrlPositions.length} searchterms`,
  );

  const searchTermsWithTopUrls = searchTermsWithUrlPositions.map(
    ({ term, url_positions }) => {
      const sorted = url_positions.sort((a, b) => a.position - b.position);

      return {
        term,
        url: sorted[0]?.url,
        position: sorted[0]?.position,
      };
    },
  );

  logJson(searchTermsWithTopUrls);

  const searchTermsWithMatches = searchTermsWithUrlPositions.map(
    ({ term }) => term,
  );

  console.log('Search terms with no matches:');
  logJson(
    topSearchTermsResults.filter(
      (results) => !searchTermsWithMatches.includes(results._id),
    ),
  );
};

export const benchCompression = async () => {
  const file = 'feedback_cleanest_2021-04-01_2023-04-16.json';

  const _data = await readFile(file, 'utf-8');

  for (const algo of ['brotli', 'zstd'] as CompressionAlgorithm[]) {
    const data = `${_data}`;
    const originalSize = Buffer.from(data).byteLength;
    const originalSizeMB = bytesToMbs(originalSize);

    if (algo === 'brotli' && originalSize > 16_777_216) {
      console.log(
        `File too big: ${originalSizeMB}MB\n` +
          `Brotli compression only supports files up to 16MB\n`,
      );

      continue;
    }

    const compressTimer = startTimer(algo);

    const compressed = await compressString(data, algo);

    compressTimer('compress');

    const compressedSize = Buffer.from(compressed.buffer).byteLength;
    const compressedSizeMB = bytesToMbs(compressedSize);

    const compressionRatio = (
      (1 - compressedSize / originalSize) *
      100
    ).toFixed(2);

    const decompressTimer = startTimer(algo);

    await decompressString(compressed, algo);

    decompressTimer('decompress');

    console.log(`Original size: ${originalSizeMB}MB`);
    console.log(`Compressed size: ${compressedSizeMB}MB`);
    console.log(`Compression ratio: ${compressionRatio}%\n`);
  }
};

/*
 * This is an example of how to inject a service into a script
 * Doing it this way can be a lot easier than through params...
 *
 * Still a little verbose with all the type annotations, but
 * much better than the alternative 🤷‍♂️
 */
export async function injectServiceExample() {
  const urlsService = (<RunScriptCommand>this).inject<UrlsService>(UrlsService);

  const url =
    'www.canada.ca/en/revenue-agency/campaigns/support-members-parliament-constituency/how-contact.html';

  const pageData = await urlsService.getPageData(url);

  logJson(pageData);
}

/*
 * Example of fetching data with AA client (old)
 */
export async function testAAClient() {
  const client = new AdobeAnalyticsClient();

  const query = createPageMetricsQuery(
    {
      start: '2024-01-01T00:00:00.000',
      end: '2024-01-01T23:59:59.999',
    },
    {
      settings: {
        limit: 2,
        page: 0,
      },
    },
  );

  const results = await client.executeQuery(query);

  logJson(results);
}

/*
 * Example of fetching data with AA client (new - used in custom reports)
 */
export async function testAAClientNew() {
  const client = new AdobeAnalyticsClientNew();

  await client.init();

  const results = await client.execute(
    createQuery({
      urls: [
        'www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html',
      ],
      dimensionName: 'url_last_255',
      metricNames: ['visits'],
      dateRange: {
        start: '2024-01-01T00:00:00.000',
        end: '2024-01-01T23:59:59.999',
      },
    }),
  );

  logJson(results);
}
