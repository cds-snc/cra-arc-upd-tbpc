import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PortalPages,
  PortalPagesDocument,
  PortalPagesMetrics,
  PortalPagesMetricsModel,
} from '@dua-upd/db';

@Injectable()
export class PortalPagesService {
  constructor(
    @InjectModel(PortalPages.name, 'defaultConnection')
    private readonly portalPagesModel: Model<PortalPagesDocument>,
    @InjectModel(PortalPagesMetrics.name, 'defaultConnection')
    private readonly portalPagesMetricsModel: PortalPagesMetricsModel,
  ) {}

  async getHomeData(dateRange: string) {
    const pages = await this.portalPagesModel.find(
      {},
      {
        title: 1,
        url: 1,
        screen_id: 1,
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
            visits: metrics.visits || 0,
          };
        }),
      )
    ).sort((a, b) => (b.visits || 0) - (a.visits || 0));

    return {
      dateRange,
      dateRangeData: results,
    };
  }

  async getDetails(id: string, dateRange: string, comparisonDateRange: string) {
    const page = await this.portalPagesModel.findById(id).lean().exec();

    const dateRangeData = await this.getMetrics(page._id, dateRange);
    const comparisonDateRangeData = await this.getMetrics(page._id, comparisonDateRange);

    const dateRangeDataByDay = await this.getPortalPageDetailsDataByDay(
      page,
      dateRange,
    );

    return {
      _id: page._id,
      title: page.title,
      url: page.url,
      screen_id: page.screen_id,
      dateRange,
      dateRangeData: {
        ...dateRangeData,
        visitsByDay: dateRangeDataByDay.map((data) => ({
          date: data.date.toISOString(),
          visits: data.visits,
        })),
      },
      comparisonDateRange,
      comparisonDateRangeData: {
        ...comparisonDateRangeData,
        visitsByDay: (await this.getPortalPageDetailsDataByDay(
          page,
          comparisonDateRange,
        )).map((data) => ({
          date: data.date.toISOString(),
          visits: data.visits,
        })),
      },
    };
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
}
