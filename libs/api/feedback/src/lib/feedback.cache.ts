import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { FeedbackParams } from './feedback.service';

@Injectable()
export class FeedbackCache {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async set<T>(namespace: string, params: FeedbackParams, data: T) {
    const cacheKey = `${namespace}:${paramsToCacheKey(params)}`;

    return this.cache.set(cacheKey, data);
  }

  async get<T>(
    namespace: string,
    params: FeedbackParams,
  ): Promise<T | undefined> {
    const cacheKey = `${namespace}:${paramsToCacheKey(params)}`;

    return this.cache.get<T>(cacheKey);
  }
}

function paramsToCacheKey(params: FeedbackParams) {
  const dateRangeStart = params.dateRange.start.toISOString().slice(0, 10);
  const dateRangeEnd = params.dateRange.end.toISOString().slice(0, 10);
  const dateRange = `${dateRangeStart}-${dateRangeEnd}`;

  const type = params.type ? `:${params.type}` : '';
  const lang = params.lang ? `:${params.lang}` : '';
  const id = params.id ? `:${params.id}` : '';
  const normalizationStrength = params.b ? `:norm${params.b}` : '';

  return `${dateRange}${type}${lang}${id}${normalizationStrength}`;
}
