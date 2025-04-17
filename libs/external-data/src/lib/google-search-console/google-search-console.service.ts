import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import {
  SearchAnalyticsClient,
  SearchAnalyticsPageQueryOptions,
} from './index';
import type { DateRange } from '@dua-upd/types-common';
import { Overall, PageMetrics } from '@dua-upd/db';
import { Retry } from '@dua-upd/utils-common';

@Injectable()
export class GoogleSearchConsoleService {
  constructor(
    private logger: ConsoleLogger,
    @Inject(SearchAnalyticsClient.name)
    private readonly client: SearchAnalyticsClient,
  ) {}

  async getOverallMetrics(
    dateRange: DateRange<string>,
    dataState: 'final' | 'all' = 'final',
    onComplete?: (results: Overall[]) => void,
  ) {
    this.logger.log('Getting Overall GSC metrics for: ', dateRange);

    const metrics = (
      await this.client.getOverallMetrics(dateRange, dataState)
    ).filter((metrics) => Object.keys(metrics).length !== 0);

    onComplete?.(metrics);

    return metrics;
  }

  @Retry(3, 520)
  async getPageMetrics(
    dateRange: DateRange<string>,
    options: {
      onComplete?: (results: Partial<PageMetrics>[]) => Promise<void>;
    } & SearchAnalyticsPageQueryOptions = {},
  ) {
    this.logger.log('Getting GSC Page metrics for: ', dateRange);

    return await this.client.getPageMetrics(dateRange, options);
  }
}
