import type {
  AAQueryConfig,
  PageFlowData,
  UrlHash,
} from '@dua-upd/types-common';
import { hours } from '@dua-upd/utils-common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';

@Injectable()
export class HashesCache {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  private generateKey(id: string): string {
    const hasher = createHash('md5');
    hasher.update(JSON.stringify(id));
    const hash = hasher.digest('hex');

    return `hashes-${hash}`;
  }

  async get(id: string): Promise<string | undefined> {
    const key = this.generateKey(id);

    return this.cache.get<string>(key);
  }

  async set(id: string, results: string): Promise<void> {
    const key = this.generateKey(id);

    await this.cache.set(key, results, hours(1));
  }
}
