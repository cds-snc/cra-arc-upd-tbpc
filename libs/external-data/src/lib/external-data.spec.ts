import dayjs from 'dayjs';
import { wait } from '@dua-upd/utils-common';
import { AirtableClient } from './airtable';
import { withRateLimit } from './utils';
import {
  AdobeAnalyticsClient,
  AdobeAnalyticsQueryBuilder,
  queryDateFormat,
  SEGMENTS,
  toQueryFormat,
} from './adobe-analytics';
import {
  getGscClient,
  Searchconsole,
  SearchAnalyticsClient,
} from './google-search-console';

// need to set a bigger timout because AA is super slow :)
jest.setTimeout(900000);

describe('AdobeAnalyticsClient', () => {
  let client: AdobeAnalyticsClient;

  beforeAll(() => {
    client = new AdobeAnalyticsClient();
  })

  it('should refresh the JWT if expired', async () => {

    const innerClient = await client.initClient(Math.floor(Date.now() / 1000) + 3);

    const initialToken = innerClient.token;

    // Token should be defined
    expect(initialToken).toBeDefined();

    await wait(3500);

    // After waiting, token should be expired
    expect(client.clientTokenIsExpired()).toEqual(true);

    // Token should get refreshed and then able to successfully get data from the API
    const dateRange = {
      start: toQueryFormat('2022-06-10'),
      end: toQueryFormat('2022-06-11'),
    };

    const data = await client.getPageMetrics(dateRange, {
      settings: {
        limit: 10
      },
      search: {
        clause: `BEGINS-WITH 'www.canada.ca' AND (BEGINS-WITH 'www.canada.ca/en/revenue-agency'\
        OR BEGINS-WITH 'www.canada.ca/fr/agence-revenu' OR BEGINS-WITH 'www.canada.ca/fr/services/impots'\
        OR BEGINS-WITH 'www.canada.ca/en/services/taxes')`,
      },
    })

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const tokenAfterCall = client.client.token;

    expect(tokenAfterCall).not.toMatch(initialToken);
  });
})

describe('getPageMetrics', () => {
  const client = new AdobeAnalyticsClient();

  it('should be able to query the API', async () => {
    const dateRange = {
      start: toQueryFormat('2022-01-01'),
      end: toQueryFormat('2022-01-02'),
    };

    const results = await client.getPageMetrics(dateRange, {
      settings: { limit: 25 },
    });

    console.log(results);

    expect(results).toBeDefined();
  });
});

describe('new AA fields', () => {
  const client = new AdobeAnalyticsClient();

  it('should work', async () => {
    const dateRange = {
      start: dayjs('2022-01-01').format(queryDateFormat),
      end: dayjs('2022-01-02').format(queryDateFormat),
    };
    const results = await client.getOverallMetrics(dateRange);
    console.log(results);
    expect(results).toBeDefined();
  });
});

describe('externalData', () => {
  const dateRange = {
    start: toQueryFormat('2022-06-01'),
    end: toQueryFormat('2022-06-02'),
  };

  it('should be able to initalize the query builder', async () => {
    const queryBuilder = new AdobeAnalyticsQueryBuilder();
    expect(queryBuilder).toBeDefined();
  });

  it('should be able to build a query', async () => {
    const queryBuilder = new AdobeAnalyticsQueryBuilder();
    const query = queryBuilder
      .addMetric('metrics/visits', '1')
      .setDimension('variables/evar12')
      .setGlobalFilters([
        {
          type: 'dateRange',
          dateRange: `${dateRange.start}/${dateRange.end}`,
        },
        {
          type: 'segment',
          segmentId: SEGMENTS.cra,
        },
      ])
      .setSearch({
        clause:
          "( CONTAINS 'www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html' )" +
          " OR ( CONTAINS 'www.canada.ca/en/revenue-agency/services/e-services/represent-a-client.html' )",
      })
      .setSettings({ limit: 10 })
      .build();

    expect(query).toBeDefined();
  });


  it('should be able to get phrases users searched on from page', async () => {
    const client = new AdobeAnalyticsClient();

    const results = await client.acquireInternalSearchItemId(dateRange);
    const array: string[] = [];

    results.forEach((result) => {
      array.push(result.internalsearch_item_id);
    });

    console.log(array.length);

    const results2 = await client.getPhrasesSearchedOnPage(
      dateRange,
      array.slice(0, 333)
    );
    console.log(results2);

    expect(results2).toBeDefined();
  });
  it('should be able to get where visitors came from', async () => {
    const client = new AdobeAnalyticsClient();

    const results = await client.acquirePageUrlItemId(dateRange)
    const array: string[] = [];

    results.forEach((result) => {
      array.push(result.pageurl_item_id);
    });

    console.log(array.length);

    const results2 = await client.getWhereVisitorsCameFrom(
      dateRange,
      array.slice(0, 1000)
    );
    console.log(results2);

    expect(results2).toBeDefined();
  });

  it('should be able to get internal searches', async () => {
    const client = new AdobeAnalyticsClient();

    const results = await client.acquireInternalSearchItemId(dateRange);
    const array: string[] = [];

    results.forEach((result) => {
      array.push(result.internalsearch_item_id);
    });

    console.log(array.length);

    const results2 = await client.getInternalSearches(
      dateRange,
      array.slice(0, 333)
    );
    console.log(results2);

    expect(results2).toBeDefined();
  });

  it('should be able to get activity map', async () => {
    const client = new AdobeAnalyticsClient();

    const results = await client.acquireActivityMapItemId(dateRange);
    const array: string[] = [];

    results.forEach((result) => {
      array.push(result.activitymap_item_id);
    });

    console.log(array.length);

    const results2 = await client.getActivityMap(
      dateRange,
      array.slice(0, 1000)
    );
    console.log(results2);

    expect(results2).toBeDefined();
  });
});

describe('Google Search Console', () => {
  let gscClient: Searchconsole;

  it('should initialise the client', () => {
    gscClient = getGscClient();
    expect(gscClient).toBeDefined();
  });

  it('should be able to get results for a basic query', async () => {
    const results = await gscClient.searchanalytics.query({
      siteUrl: 'https://www.canada.ca/',
      requestBody: {
        dimensions: ['date', 'query'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'equals',
                expression: 'https://www.canada.ca/en/services/taxes.html',
              },
            ],
          },
        ],
        startDate: '2022-01-01',
        endDate: '2022-01-02',
      },
    });

    expect(results.data.rows).toBeDefined();
  });

  it('should be able to get results for GSC overall metrics for all CRA-related pages', async () => {
    const client = new SearchAnalyticsClient();
    const results = await client.getOverallMetrics({
      start: '2022-01-16',
      end: '2022-01-16',
    });

    expect(results).toBeDefined();
  });

  it('should be able to get results for GSC search terms for all CRA-related pages', async () => {
    const client = new SearchAnalyticsClient();
    const results = await client.getPageMetrics({
      start: '2022-01-16',
      end: '2022-01-16',
    });

    expect(results).toBeDefined();
  });

  it('should be able to get results for fresh data', async () => {
    const results = await gscClient.searchanalytics.query({
      siteUrl: 'https://www.canada.ca/',
      requestBody: {
        dimensions: ['date', 'query'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'equals',
                expression: 'https://www.canada.ca/en/services/taxes.html',
              },
            ],
          },
        ],
        startDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        dataState: 'all',
      },
    });
    console.log(results.data.rows);

    expect(results.data.rows).toBeDefined();
  });

  it('should be able to get results for a regex', async () => {
    const results = await gscClient.searchanalytics.query({
      siteUrl: 'https://www.canada.ca/',
      requestBody: {
        dimensions: ['date', 'query', 'page'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'includingRegex',
                expression:
                  '/en/revenue-agency|/fr/agence-revenu|/en/services/taxes|/fr/services/impots',
              },
            ],
          },
        ],
        startDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        dataState: 'all',
      },
    });

    expect(results.data.rows).toBeDefined();
  });
});

describe('AirTable', () => {
  it('should initialise the client', async () => {
    const client = new AirtableClient();
    const results = await client.getTasks();

    console.log(results);
  });
  //
  // it('should find a task', async () => {
  //   const client = new AirtableClient();
  //   const results = await client.findTask('recIDdp2y3RQkzqy7');
  //
  //   console.log(results);
  // });
  //
  // it('should grab all data from the start/end dates and call drivers bases/tables, and parse them into 1 array', async () => {
  //   const client = new AirtableClient();
  //   const results = await client.getCallDriver({
  //     start: '2021-11-30',
  //     end: '2021-12-01',
  //   });
  //
  //   console.log(results);
  //   console.log(results.length);
  // });
});

describe.skip('rate-limiting', () => {
  it('should rate-limit the function', async () => {
    const addAsync = async (a: number, b: number) => a + b;
    const rateLimitedAdd = withRateLimit<number, Parameters<typeof addAsync>>(
      addAsync,
      2
    );

    const numbersToAdd = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const results = await Promise.all(
      numbersToAdd.map((number) => rateLimitedAdd(number, 2))
    );

    expect(results).toBeDefined();
  });
});
