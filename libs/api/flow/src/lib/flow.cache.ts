import type { AAQueryConfig, PageFlowData } from '@dua-upd/types-common';
import { hours } from '@dua-upd/utils-common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';

@Injectable()
export class FlowCache {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  private generateKey(query: AAQueryConfig): string {
    const hasher = createHash('md5');
    hasher.update(JSON.stringify(query));
    const hash = hasher.digest('hex');

    return `flow-query-${hash}`;
  }

  async get(query: AAQueryConfig): Promise<PageFlowData[] | undefined> {
    const key = this.generateKey(query);

    return this.cache.get<PageFlowData[]>(key);
  }

  async set(query: AAQueryConfig, results: PageFlowData[]): Promise<void> {
    const key = this.generateKey(query);

    await this.cache.set(key, results, hours(1));
  }
}
