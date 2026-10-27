import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { compressString, decompressString } from '@dua-upd/node-utils';
import { PortalPages, PortalPagesMetrics } from '@dua-upd/db';
import type { PortalPagesDocument, PortalPagesMetricsModel } from '@dua-upd/db';
import {
  PortalPageDetailsData,
  PortalPagesHomeAggregatedData,
} from '@dua-upd/types-common';

@Injectable()
export class PortalPagesService {
  constructor(
    @InjectModel(PortalPages.name, 'defaultConnection')
    private portalPagesModel: Model<PortalPagesDocument>,
    @InjectModel(PortalPagesMetrics.name, 'defaultConnection')
    private portalPagesMetricsModel: PortalPagesMetricsModel,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getHomeData(dateRange: string) {
    const cacheKey = `getPagesHomeData-${dateRange}`;

    const cachedData = await this.cacheManager.get<string>(cacheKey).then(
      async (cachedData) =>
        cachedData &&
        ((await decompressString(cachedData)) as unknown as {
          dateRange: string;
          dateRangeData: PortalPagesHomeAggregatedData[];
        }),
    );

    if (cachedData) {
      return cachedData;
    }

    const pages = await this.portalPagesModel.find(
      {},
      {
        title: 1,
        url: 1,
        screen_id: 1,
        lang: 1,
        type: 1,
      },
    );

    const results = (
      await Promise.all(
        pages.map(async (page) => {
          const metrics = await this.getMetrics(page._id, dateRange);

          return {
            _id: page._id,
            title: page.title,
            url: page.url,
            screen_id: page.screen_id,
            type: page.type ?? null,
            visits: metrics.visits || 0,
            lang: page.lang,
          };
        }),
      )
    ).sort((a, b) => (b.visits || 0) - (a.visits || 0));

    await this.cacheManager.set(
      cacheKey,
      await compressString(
        JSON.stringify({
          dateRange,
          dateRangeData: results,
        }),
      ),
    );

    return {
      dateRange,
      dateRangeData: results,
    };
  }

  async getDetails(id: string, dateRange: string, comparisonDateRange: string) {
    const cacheKey = `getPageDetails-${id}-${dateRange}-${comparisonDateRange}`;
    const cachedData =
      await this.cacheManager.get<PortalPageDetailsData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }
    const page = await this.portalPagesModel.findById(id).lean().exec();

    const altLang = page.lang === 'en' ? 'fr' : 'en';
    const alternateUrl = page.url?.replace(/\/(en|fr)(?=\/|$)/, `/${altLang}`);
    const alternatePageMatch = page.screen_id
      ? { screen_id: page.screen_id }
      : alternateUrl
        ? { url: alternateUrl }
        : null;
    const alternatePage =
      page.lang && alternatePageMatch
        ? await this.portalPagesModel
            .findOne(
              {
                ...alternatePageMatch,
                lang: altLang,
              },
              { _id: 1 },
            )
            .lean()
            .exec()
        : null;
    const alternatePageId = alternatePage?._id.toString() ?? null;

    const dateRangeData = await this.getMetrics(page._id, dateRange);
    const comparisonDateRangeData = await this.getMetrics(
      page._id,
      comparisonDateRange,
    );

    const results = {
      _id: page._id,
      title: page.title,
      url: page.url,
      screen_id: page.screen_id,
      type: page.type ?? null,
      alternatePageId,
      lang: page.lang,
      dateRange,
      dateRangeData: {
        ...dateRangeData,
        visitsByDay: (
          await this.getPortalPageDetailsDataByDay(page, dateRange)
        ).map((data) => ({
          date: data.date.toISOString(),
          visits: data.visits,
        })),
      },
      comparisonDateRange,
      comparisonDateRangeData: {
        ...comparisonDateRangeData,
        visitsByDay: (
          await this.getPortalPageDetailsDataByDay(page, comparisonDateRange)
        ).map((data) => ({
          date: data.date.toISOString(),
          visits: data.visits,
        })),
      },
    };

    await this.cacheManager.set(cacheKey, results);

    return results;
  }

  private async getMetrics(pageId: Types.ObjectId, dateRange: string) {
    const metrics: (
      | keyof PortalPagesMetrics
      | { $avg: keyof PortalPagesMetrics }
    )[] = [
      'visits',
      'visitors',
      'views',
      'visits_geo_ab',
      'visits_geo_bc',
      'visits_geo_mb',
      'visits_geo_nb',
      'visits_geo_nl',
      'visits_geo_ns',
      'visits_geo_nt',
      'visits_geo_nu',
      'visits_geo_on',
      'visits_geo_pe',
      'visits_geo_qc',
      'visits_geo_sk',
      'visits_geo_yt',
      'visits_geo_outside_canada',
      'visits_geo_us',
      'visits_device_other',
      'visits_device_desktop',
      'visits_device_mobile',
      'visits_device_tablet',
      { $avg: 'average_time_spent' },
    ];

    const result = (
      await this.portalPagesMetricsModel.getAggregatedPortalPageMetrics(
        dateRange,
        metrics,
        { pages: pageId },
      )
    )[0];

    const defaults = Object.fromEntries(
      metrics.map((metric) => [
        typeof metric === 'string' ? metric : Object.values(metric)[0],
        0,
      ]),
    );

    return {
      ...defaults,
      ...result,
    };
  }

  async getPortalPageDetailsDataByDay(
    page: { _id: Types.ObjectId },
    dateRange: string,
  ) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    return await this.portalPagesMetricsModel
      .aggregate<PortalPagesMetrics>([
        {
          $match: {
            pages: page._id,
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $project: {
            _id: 0,
            visits: 1,
            date: 1,
          },
        },
        {
          $group: {
            _id: '$date',
            date: {
              $first: '$date',
            },
            visits: {
              $sum: '$visits',
            },
          },
        },
      ])
      .sort('date')
      .exec();
  }

  async getPageId(screen_id: string, pageLang: string) {
    const pageId = await this.portalPagesModel
      .findOne(
        {
          $expr: {
            $and: [
              { $eq: [{ $toLower: '$screen_id' }, screen_id.toLowerCase()] },
              { $eq: [{ $toLower: '$lang' }, pageLang.toLowerCase()] },
            ],
          },
        },
        { _id: 1 },
      )
      .lean()
      .exec();
    return { id: pageId?._id.toString() || null };
  }
}
