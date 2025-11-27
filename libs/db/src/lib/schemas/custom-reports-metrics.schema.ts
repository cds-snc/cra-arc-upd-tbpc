import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Model } from 'mongoose';
import { filter, map } from 'rambdax';
import { ModelWithStatics, isNullish, logJson } from '@dua-upd/utils-common';
import type {
  ICustomReportsMetrics,
  ReportConfig,
  ReportGranularity,
} from '@dua-upd/types-common';
import { createHash } from 'crypto';

export const granularities: readonly ReportGranularity[] = [
  'day',
  'week',
  'month',
  'none',
] as const;

export type ReportRow = {
  startDate: Date;
  endDate?: Date;
  date?: Date;
  [p: string]: unknown;
};

@Schema({ collection: 'custom_reports_metrics' })
export class CustomReportsMetrics implements ICustomReportsMetrics {
  @Prop({ type: Types.ObjectId, required: true })
  _id: Types.ObjectId;

  @Prop({ type: String, required: false, index: true })
  url?: string;

  @Prop({ type: [String], required: false, index: true })
  urls?: string[];

  @Prop({ type: String, required: false, index: true })
  urlsHash?: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({
    type: String,
    enum: granularities,
    required: true,
    index: true,
  })
  granularity: ReportGranularity;

  @Prop({ type: Boolean, required: true, index: true })
  grouped: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  metrics: ICustomReportsMetrics['metrics'] = {};

  // for breakdowns by dimension
  @Prop({ type: MongooseSchema.Types.Mixed, required: false})
  metrics_by: ICustomReportsMetrics['metrics_by'] = {};

  static async getMetrics(
    this: Model<CustomReportsMetrics>,
    config: ReportConfig<Date>,
  ): Promise<CustomReportsMetrics[]> {


  const normalizedUrls = (config.urls || []).map((url) => String(url)).sort();

  const urlsHash =
    normalizedUrls.length
      ? createHash('md5')
        .update(JSON.stringify(normalizedUrls))
        .digest('hex')
      : undefined;

   const urls = config.grouped
     ? { urlsHash }
     : { url: { $in: normalizedUrls } };

    const defaultQuery = {
      startDate: {
        $gte: config.dateRange.start,
        $lte: config.dateRange.end,
      },
      endDate: {
        $gte: config.dateRange.start,
        $lte: config.dateRange.end,
      },
    };

    const noneGranularityQuery = {
      startDate: config.dateRange.start,
      endDate: config.dateRange.end,
    };

    const dates =
      config.granularity === 'day'
        ? {
            startDate: defaultQuery.startDate,
          }
        : config.granularity === 'none'
          ? noneGranularityQuery
          : defaultQuery;

    const query = {
      ...urls,
      ...dates,
      grouped: config.grouped,
      granularity: config.granularity,
    };

    logJson(query);

    return (await this.find(query).lean().exec()) || [];
  }

  static createReportFormatter<T extends { [columnName: string]: unknown }>(
    config: ReportConfig<Date>,
  ) {
    const { metrics, granularity, grouped, breakdownDimension } = config;
    const toDates = (document: ICustomReportsMetrics) =>
      granularity === 'day'
        ? { date: document.startDate }
        : { startDate: document.startDate, endDate: document.endDate };

    type Metrics = { [metricName: string]: number };

    type DimensionMetrics = { dimensionValue: string } & {
      [metricName: string]: number;
    };

    const filterMetrics = filter((v, k) => metrics.includes(k));

    const dimensionMetrics = ['dimensionValue', ...metrics];
    const filterDimensionMetrics = filter((v, k) =>
      dimensionMetrics.includes(k),
    );

    const docToRows = (document: ICustomReportsMetrics) => {
      const dates = toDates(document);

      const url = grouped ? {} : { url: document.url };

      if (breakdownDimension) {
        const dimensionMetrics = map(
          filterDimensionMetrics,
          document.metrics_by?.[breakdownDimension] || [],
        ) as DimensionMetrics[];

        return dimensionMetrics.map(
          ({ dimensionValue, ...dimensionMetrics }) => {
            const row = {
              ...dates,
              ...url,
              [breakdownDimension]: dimensionValue,
              ...dimensionMetrics,
            };

            // fill in missing values with null
            for (const metric of metrics) {
              if (isNullish(row[metric])) {
                row[metric] = null;
              }
            }

            return row;
          },
        );
      }

      const docMetrics: Metrics = filterMetrics(document.metrics || {});

      if (Object.keys(docMetrics).length === 0) {
        // flatMap will filter out empty rows
        return [];
      }

      const row = {
        ...dates,
        ...url,
        ...docMetrics,
      };

      // fill in missing values with null
      for (const metric of metrics) {
        if (isNullish(row[metric])) {
          row[metric] = null;
        }
      }

      return row;
    };

    const sortRows = (a, b) => {
      const aDate = granularity === 'day' ? a.date : a.startDate;
      const bDate = granularity === 'day' ? b.date : b.startDate;

      const dateCompare = aDate.getTime() - bDate.getTime();
      const urlCompare = a.url?.localeCompare(b.url);
      const breakdownCompare = a[breakdownDimension]?.localeCompare(
        b[breakdownDimension],
      );

      return dateCompare !== 0 ? dateCompare : urlCompare || breakdownCompare;
    };

    return (documents: ICustomReportsMetrics[]) =>
      documents.flatMap(docToRows).sort(sortRows) as unknown as T[];
  }

  static async getReport(
    this: CustomReportsModel,
    config: ReportConfig<Date>,
  ): Promise<ReportRow[]> {
    const formatter = this.createReportFormatter<ReportRow>(config);
    const metrics = await this.getMetrics(config);

    return formatter(metrics);
  }
}

export const CustomReportsMetricsSchema =
  SchemaFactory.createForClass(CustomReportsMetrics);

const statics = {
  getMetrics: CustomReportsMetrics.getMetrics,
  getReport: CustomReportsMetrics.getReport,
  createReportFormatter: CustomReportsMetrics.createReportFormatter,
};

CustomReportsMetricsSchema.statics = statics;

export type CustomReportsModel = ModelWithStatics<
  CustomReportsMetrics,
  typeof statics
>;

CustomReportsMetricsSchema.index(
  { url: 1, startDate: 1, endDate: 1, grouped: 1, granularity: 1 },
  {
    partialFilterExpression: {
      url: { $exists: true },
      grouped: false,
    },
    unique: true,
  },
);

CustomReportsMetricsSchema.index(
  { urlsHash: 1, startDate: 1, endDate: 1, grouped: 1, granularity: 1 },
  {
    partialFilterExpression: {
      urlsHash: { $exists: true },
      grouped: true,
    },
  },
);

CustomReportsMetricsSchema.index(
  { url: 1, startDate: 1, grouped: 1, granularity: 1 },
  {
    partialFilterExpression: {
      url: { $exists: true },
      grouped: false,
      granularity: 'day',
    },
    unique: true,
  },
);

CustomReportsMetricsSchema.index(
  { urlsHash: 1, startDate: 1, grouped: 1, granularity: 1 },
  {
    partialFilterExpression: {
      urlsHash: { $exists: true },
      grouped: true,
      granularity: 'day',
    },
  },
);
