import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { FilterQuery } from 'mongoose';
import type { Cache } from 'cache-manager';
import type {
  Overall,
} from '@dua-upd/db';
import {
  DbService,
} from '@dua-upd/db';
import {
  dateRangeSplit,
} from '@dua-upd/utils-common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

export interface TopSearchPages {
  term: string;
  url_positions: { url: string; position: number; clicks: number }[];
}

dayjs.extend(utc);

@Injectable()
export class InternalSearchService {
  constructor(
    private db: DbService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async getMasterList(lang) {
    const cacheKey = `getMasterList_${lang}`;
    const cachedData = await this.cacheManager.store.get<string[]>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // adobe analytics

  }

  async getInternalSearchTerms(lang, dateRange) {
    const cacheKey = `getInternalSearchTermsData`;
    const cachedData = await this.cacheManager.store.get<TopSearchPages>(
      cacheKey
    );

    if (cachedData) {
      return cachedData;
    }

    const [startDate, endDate] = dateRangeSplit(dateRange);

    const dateRangeFilter = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const topSearchTerms = await this.getTopSearchFromOverall(
      lang,
      dateRangeFilter
    );
    const topSearchPages = await this.getTopSearchTermPages(
      lang,
      dateRangeFilter,
      topSearchTerms
    );

    return {
      lang,
      dateRange,
      topSearchTerms,
      topSearchPages
    };
  }

  async getTopSearchFromOverall(
    lang: 'en' | 'fr',
    dateRange: FilterQuery<Overall>
  ) {
    const searchTermSelector =
      lang === 'en' ? 'aa_searchterms_en' : 'aa_searchterms_fr';

    const topSearchTermsResults = await this.db.collections.overall
      .aggregate<{ term: string; clicks: number; num_searches: number }>()
      .match(dateRange)
      .project({
        date: 1,
        aa_searchterms_en: 1,
        aa_searchterms_fr: 1,
      })
      .unwind(`${searchTermSelector}`)
      .project({
        date: 1,
        term: {
          $toLower: `$${searchTermSelector}.term`,
        },
        clicks: `$${searchTermSelector}.clicks`,
        num_searches: `$${searchTermSelector}.num_searches`,
      })
      .group({
        _id: {
          date: '$date',
          term: '$term',
        },
        clicks: {
          $sum: '$clicks',
        },
        num_searches: {
          $sum: '$num_searches',
        },
      })
      .group({
        _id: '$_id.term',
        clicks: {
          $sum: '$clicks',
        },
        num_searches: {
          $sum: '$num_searches',
        },
      })
      .project({
        term: '$_id',
        _id: 0,
        clicks: 1,
        num_searches: 1,
      })
      .sort({ num_searches: -1, _id: 1 })
      .limit(250)
      .exec();

    return topSearchTermsResults;
  }

  async getTopSearchTermPages(
    lang: 'en' | 'fr',
    dateRange: FilterQuery<Overall>,
    data: { term: string; clicks: number; num_searches: number }[]
  ) {
    const topSearchTerms = data.map((result) => result.term);

    return await this.db.collections.pageMetrics
      .aggregate<TopSearchPages>()
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
        ...dateRange,
        url: new RegExp(`^www\\.canada\\.ca/${lang}/`),
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
        clicks: '$aa_searchterms.clicks',
      })
      .group({
        _id: {
          term: '$term',
          url: '$url',
          clicks: '$clicks',
        },
        position: {
          $avg: '$position',
        },
      })
      .group({
        _id: {
          term: '$_id.term',
          url: '$_id.url',
        },
        clicks: {
          $sum: '$_id.clicks',
        },
        position: {
          $avg: '$position',
        },
      })
      .project({
        term: '$_id.term',
        url_position: {
          url: '$_id.url',
          clicks: '$clicks',
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
  }
}
