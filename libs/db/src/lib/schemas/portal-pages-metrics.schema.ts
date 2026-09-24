import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PipelineStage, QueryFilter, Types, type Document } from 'mongoose';
import type { IPortalPagesMetrics } from '@dua-upd/types-common';
import type { PortalPages } from './portal-pages.schema';
import { ModelWithStatics } from '@dua-upd/utils-common';

export type PortalPagesMetricsDocument = PortalPagesMetrics & Document;

@Schema({ collection: 'portal_pages_metrics' })
export class PortalPagesMetrics implements IPortalPagesMetrics {
  @Prop({ type: Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ required: true, type: Date, index: true })
  date = new Date(0);

  @Prop({ required: true, type: String })
  language: 'en' | 'fr' = 'en';

  @Prop({ type: Types.ObjectId, ref: 'PortalPages', index: true, default: null })
  pages: Types.ObjectId | PortalPages | null = null;

  @Prop({ type: Number })
  visits = 0;

  @Prop({ type: Number })
  visitors = 0;

  @Prop({ type: Number })
  views = 0;

  @Prop({ type: Number })
  average_time_spent = 0;

  @Prop({ type: Number })
  visits_geo_ab = 0;

  @Prop({ type: Number })
  visits_geo_bc = 0;

  @Prop({ type: Number })
  visits_geo_mb = 0;

  @Prop({ type: Number })
  visits_geo_nb = 0;

  @Prop({ type: Number })
  visits_geo_nl = 0;

  @Prop({ type: Number })
  visits_geo_ns = 0;

  @Prop({ type: Number })
  visits_geo_nt = 0;

  @Prop({ type: Number })
  visits_geo_nu = 0;

  @Prop({ type: Number })
  visits_geo_on = 0;

  @Prop({ type: Number })
  visits_geo_pe = 0;

  @Prop({ type: Number })
  visits_geo_qc = 0;

  @Prop({ type: Number })
  visits_geo_sk = 0;

  @Prop({ type: Number })
  visits_geo_yt = 0;

  @Prop({ type: Number })
  visits_geo_outside_canada = 0;

  @Prop({ type: Number })
  visits_geo_us = 0;

  @Prop({ type: Number })
  visits_device_other = 0;

  @Prop({ type: Number })
  visits_device_desktop = 0;

  @Prop({ type: Number })
  visits_device_mobile = 0;

  @Prop({ type: Number })
  visits_device_tablet = 0;
}

export type PortalMetricsConfig<T> = {
  [key in '$sum' | '$avg']?: keyof Partial<T>;
};

export async function getAggregatedPortalPageMetrics<T>(
  this: PortalPagesMetricsModel,
  dateRange: string,
  selectedMetrics: (keyof T | PortalMetricsConfig<T>)[],
  pagesFilter?: QueryFilter<PortalPagesMetrics>,
): Promise<T[]> {
  const [startDate, endDate] = dateRange.split('/').map((date) => new Date(date));

  const projections: Record<string, number> = {};
  const aggregations: Record<
    string,
    { $sum?: string; $avg?: string }
  > = {};

  for (const metric of selectedMetrics) {
    const metricName =
      typeof metric === 'string' ? metric : Object.values(metric)[0];
    const operator =
      typeof metric === 'string' ? '$sum' : Object.keys(metric)[0];

    projections[metricName as string] = 1;
    aggregations[metricName as string] = {
      [operator]: `$${metricName}`,
    };
  }

  return this.aggregate<T>()
    .match({
      date: { $gte: startDate, $lte: endDate },
      pages: { $exists: true },
      ...(pagesFilter || {}),
    } as PipelineStage.Match['$match'])
    .project({
      pages: 1,
      ...projections,
    })
    .group({
      _id: '$pages',
      ...aggregations,
    })
    .lookup({
      from: 'portal_pages',
      localField: '_id',
      foreignField: '_id',
      as: 'page',
    })
    .project({
      ...projections,
      url: { $first: '$page.url' },
      title: { $first: '$page.title' },
    })
    .exec();
}

const statics = {
  getAggregatedPortalPageMetrics,
};

export const PortalPagesMetricsSchema =
  SchemaFactory.createForClass(PortalPagesMetrics);

PortalPagesMetricsSchema.statics = statics;

export type PortalPagesMetricsModel = ModelWithStatics<
  PortalPagesMetrics,
  typeof statics
>;

PortalPagesMetricsSchema.index(
  { date: 1, pages: 1, language: 1 },
  { unique: true, partialFilterExpression: { pages: { $exists: true } } },
);
