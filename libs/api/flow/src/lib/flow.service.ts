import { Inject, Injectable } from '@nestjs/common';
import { FlowCache } from './flow.cache';
import {
  AA_CLIENT_TOKEN,
  AdobeAnalyticsClient,
  createQuery,
} from '@dua-upd/api/custom-reports';
import {
  AAQueryConfig,
  AAQueryDateRange,
  Direction,
  PageFlowData,
} from '@dua-upd/types-common';
import { AAResponseBody } from '@dua-upd/node-utils';
import { DbService, Page, PageDocument } from '@dua-upd/db';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class FlowService {
  constructor(
    @Inject(AA_CLIENT_TOKEN) private aaClient: AdobeAnalyticsClient,
    private db: DbService,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
    private cache: FlowCache,
  ) {}

  async getFlowData(
    direction: Direction,
    limit: number,
    urls: string | string[],
    dateRange: AAQueryDateRange,
  ): Promise<PageFlowData[]> {
    const query: AAQueryConfig = {
      dateRange,
      metricNames: ['occurences'],
      dimensionName: 'url_last_255',
      urls,
      direction,
      limit,
    };

    const cachedResults = await this.cache.get(query);

    if (cachedResults) {
      return cachedResults;
    }

    const queryResults = parseQueryResults(
      await this.aaClient.execute(createQuery(query)),
    );

    const flowData = await this.addPageTitles(queryResults);

    await this.cache.set(query, flowData);

    return flowData;
  }

  async addPageTitles(data: PageFlowData[]): Promise<PageFlowData[]> {
    return Promise.all(
      data.map(async (row) => {
        const title = (
          await this.pageModel
            .findOne({ url: row.url }, { title: 1 })
            .lean()
            .exec()
        )?.title;
        return { ...row, title };
      }),
    );
  }
}

function parseQueryResults(results: AAResponseBody): PageFlowData[] {
  const totalValue = results.summaryData?.totals[0] || 0;

  return results.rows.map((row) => {
    const data = Object.fromEntries(
      row.data
        .filter((value) => typeof value !== 'string')
        .map((value) => ['visits', value as number])
        .concat([['url' as const, row.value]]),
    );

    return {
      ...data,
      total: totalValue,
    };
  });
}
