import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type Document, Types, type FilterQuery } from 'mongoose';
import type {
  AASearchTermMetrics,
  AccumulatorOperator,
  ActivityMapMetrics,
  DateRange,
  IPage,
  IPageMetrics,
  IProject,
  ITask,
  IUxTest,
} from '@dua-upd/types-common';
import {
  $trunc,
  ModelWithStatics,
  arrayToDictionary,
  dateRangeSplit,
  percentChange,
} from '@dua-upd/utils-common';
import type { Page } from './page.schema';
import type { PageMetricsTS } from './page-metrics-ts.schema';
import { MetricsCommon } from './metrics-common.schema';

export type PageMetricsDocument = PageMetrics & Document;

@Schema({ collection: 'pages_metrics' })
export class PageMetrics extends MetricsCommon implements IPageMetrics {
  @Prop({ required: true, type: Date, index: true })
  date = new Date(0);

  @Prop({ required: true, type: String, index: true })
  url = '';

  @Prop({ type: [{ term: String, clicks: Number, position: Number }] })
  aa_searchterms?: AASearchTermMetrics[];

  @Prop({ type: Types.ObjectId, ref: 'Page', index: true })
  page?: Types.ObjectId | Page;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Task' }], index: true })
  tasks?: Types.ObjectId[] | ITask[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Project' }], index: true })
  projects?: Types.ObjectId[] | IProject[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'UxTest' }], index: true })
  ux_tests?: Types.ObjectId[] | IUxTest[];

  @Prop({
    type: [
      {
        link: String,
        clicks: Number,
      },
    ],
  })
  activity_map?: ActivityMapMetrics[] = [];
}

export const PageMetricsSchema = SchemaFactory.createForClass(PageMetrics);

PageMetricsSchema.index({ date: 1, url: 1 }, { unique: true });
PageMetricsSchema.index(
  { date: 1, page: 1 },
  { partialFilterExpression: { page: { $exists: true } } },
);

PageMetricsSchema.index(
  { date: 1, tasks: 1 },
  {
    name: 'date_1_tasks_exists',
    partialFilterExpression: { 'tasks.0': { $exists: true } },
  },
);

PageMetricsSchema.index(
  { date: 1, projects: 1 },
  {
    name: 'date_1_projects_exists',
    partialFilterExpression: { 'projects.0': { $exists: true } },
  },
);

PageMetricsSchema.index(
  { date: -1 },
  {
    name: 'activitymap_date_desc',
    partialFilterExpression: {
      'activity_map.0': { $exists: true },
    },
  },
);

export type MetricsConfig<T> = {
  [key in AccumulatorOperator]?: keyof Partial<T>;
};

export async function getAggregatedPageMetrics<T>(
  this: PageMetricsModel,
  dateRange: string,
  selectedMetrics: (keyof T | MetricsConfig<T>)[],
  pagesFilter?: FilterQuery<PageMetrics>,
  sortConfig?: { [key in keyof Partial<T>]: 1 | -1 },
): Promise<T[]> {
  const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

  const metricsProjections: Record<string, number> = {};
  const metricsGroupAggregations: Record<
    string,
    { [key in AccumulatorOperator]?: string }
  > = {};
  const metricsSort: Record<string, 1 | -1> = sortConfig || {};

  for (const [i, metric] of selectedMetrics.entries()) {
    const metricName =
      typeof metric === 'string' ? metric : Object.values(metric)[0];
    const metricOperator =
      typeof metric === 'string' ? '$sum' : Object.keys(metric)[0];

    metricsProjections[metricName] = 1;
    metricsGroupAggregations[metricName] = {
      [metricOperator]: `$${metricName}`,
    };

    if (!sortConfig && i === 0) {
      metricsSort[metricName] = -1;
    }
  }
  const pagesFilterQuery = pagesFilter || {};

  return await this.aggregate<T>()
    .match({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      page: { $exists: true },
      ...pagesFilterQuery,
    })
    .project({
      page: 1,
      date: 1,
      ...metricsProjections,
    })
    .group({
      _id: '$page',
      ...metricsGroupAggregations,
    })
    .lookup({
      from: 'pages',
      localField: '_id',
      foreignField: '_id',
      as: 'page',
    })
    .project({
      ...metricsProjections,
      url: {
        $first: '$page.url',
      },
      title: {
        $first: '$page.title',
      },
    })
    .sort(metricsSort)
    .exec();
}

// export async function toTimeSeries(
//   this: PageMetricsModel,
//   dateRange: DateRange<Date>,
// ) {
//   return await this.aggregate<PageMetricsTS>()
//     .match({ date: { $gte: dateRange.start, $lte: dateRange.end } })
//     .addFields({
//       meta: {
//         url: '$url',
//         page: '$page',
//         projects: {
//           $cond: {
//             if: {
//               $eq: [{ $size: { $ifNull: ['$projects', []] } }, 0],
//             },
//             then: '$$REMOVE',
//             else: '$projects',
//           },
//         },
//         tasks: {
//           $cond: {
//             if: {
//               $eq: [{ $size: { $ifNull: ['$tasks', []] } }, 0],
//             },
//             then: '$$REMOVE',
//             else: '$tasks',
//           },
//         },
//         ux_tests: {
//           $cond: {
//             if: {
//               $eq: [{ $size: { $ifNull: ['$ux_tests', []] } }, 0],
//             },
//             then: '$$REMOVE',
//             else: '$ux_tests',
//           },
//         },
//       },
//       average_time_spent: {
//         $ifNull: [$trunc('$average_time_spent', 3), 0],
//       },
//       bouncerate: { $ifNull: [$trunc('$bouncerate', 3), 0] },
//       gsc_total_ctr: { $ifNull: [$trunc('$gsc_total_ctr', 3), 0] },
//       gsc_total_impressions: {
//         $ifNull: [$trunc('$gsc_total_impressions', 3), 0],
//       },
//       gsc_total_position: {
//         $ifNull: [$trunc('$gsc_total_position', 3), 0],
//       },
//       gsc_searchterms: {
//         $cond: {
//           if: {
//             $eq: [{ $size: { $ifNull: ['$gsc_searchterms', []] } }, 0],
//           },
//           then: '$$REMOVE',
//           else: {
//             $map: {
//               input: '$gsc_searchterms',
//               as: 'searchterm',
//               in: {
//                 clicks: '$$searchterm.clicks',
//                 ctr: $trunc('$$searchterm.ctr', 3),
//                 impressions: '$$searchterm.impressions',
//                 position: $trunc('$$searchterm.position', 3),
//                 term: '$$searchterm.term',
//               },
//             },
//           },
//         },
//       },
//       aa_searchterms: {
//         $cond: {
//           if: {
//             $eq: [{ $size: { $ifNull: ['$aa_searchterms', []] } }, 0],
//           },
//           then: '$$REMOVE',
//           else: {
//             $map: {
//               input: '$aa_searchterms',
//               as: 'searchterm',
//               in: {
//                 term: '$$searchterm.term',
//                 clicks: '$$searchterm.clicks',
//                 position: '$$searchterm.position',
//               },
//             },
//           },
//         },
//       },
//     })
//     .project({
//       page: 0,
//       projects: 0,
//       tasks: 0,
//       ux_tests: 0,
//       url: 0,
//     })
//     .exec();
// }

export type MetricsByPage = {
  _id: Types.ObjectId;
  visits: number;
  dyfYes: number;
  dyfNo: number;
  gscTotalClicks: number;
  gscTotalImpressions: number;
  gscTotalCtr: number;
  gscTotalPosition: number;
  feedbackToVisitsRatio: number | null;
};

export type AggregatedMetricsType = {
  visits: number;
  dyfYes: number;
  dyfNo: number;
  feedbackToVisitsRatio: number | null;
  gscTotalClicks: number;
  gscTotalImpressions: number;
  gscTotalCtr: number;
  gscTotalPosition: number;
  visitsByPage: MetricsByPage[];
};

export type AggregatedMetricsWithPercentChange = {
  visits: number;
  dyfYes: number;
  dyfNo: number;
  visitsComparison: number;
  dyfYesComparison: number;
  dyfNoComparison: number;
  gscTotalClicks: number;
  gscTotalImpressions: number;
  gscTotalCtr: number;
  gscTotalPosition: number;
  visitsPercentChange: number;
  gscTotalClicksPercentChange: number | null;
  gscTotalImpressionsPercentChange: number | null;
  gscTotalCtrPercentChange: number;
  gscTotalPositionPercentChange: number | null;
  visitsByPage: {
    _id: string;
    visits: number;
    dyfYes: number;
    dyfNo: number;
    feedbackToVisitsRatio: number | null;
    title: string;
    url: string;
    lang?: string;
    is_404?: boolean;
    redirect?: string;
    language: string;
    is404: boolean;
    isRedirect: boolean;
    pageStatus: string;
    gscTotalClicks: number;
    gscTotalImpressions: number;
    gscTotalCtr: number;
    gscTotalPosition: number;
    visitsPercentChange: number | null;
    dyfNoPercentChange: number | null;
  }[];
};

// for common data required in tasks/projects
export async function getAggregatedMetrics(
  this: PageMetricsModel,
  dateRange: string,
  idFilter: { tasks: Types.ObjectId } | { projects: Types.ObjectId },
): Promise<AggregatedMetricsType | null> {
  const [startDate, endDate] = dateRangeSplit(dateRange);

  const matchFilter: FilterQuery<PageMetrics> = {
    date: {
      $gte: startDate,
      $lte: endDate,
    },
    ...idFilter,
  };

  const refProjection = Object.fromEntries(
    Object.keys(idFilter).map((key) => [key, 1]),
  );

  return this.aggregate<AggregatedMetricsType>()
    .project({
      date: 1,
      page: 1,
      visits: 1,
      dyf_yes: 1,
      dyf_no: 1,
      gsc_total_clicks: 1,
      gsc_total_impressions: 1,
      gsc_total_ctr: 1,
      gsc_total_position: 1,
      ...refProjection,
    })
    .match(matchFilter)
    .group({
      _id: '$page',
      visits: { $sum: '$visits' },
      dyfYes: { $sum: '$dyf_yes' },
      dyfNo: { $sum: '$dyf_no' },
      gscTotalClicks: { $sum: '$gsc_total_clicks' },
      gscTotalImpressions: { $sum: '$gsc_total_impressions' },
      gscTotalCtr: { $avg: '$gsc_total_ctr' },
      gscTotalPosition: { $avg: '$gsc_total_position' },
    })
    .group({
      _id: 'null',
      visits: { $sum: '$visits' },
      dyfYes: { $sum: '$dyfYes' },
      dyfNo: { $sum: '$dyfNo' },
      gscTotalClicks: { $sum: '$gscTotalClicks' },
      gscTotalImpressions: { $sum: '$gscTotalImpressions' },
      gscTotalCtr: { $avg: '$gscTotalCtr' },
      gscTotalPosition: { $avg: '$gscTotalPosition' },
      visitsByPage: {
        $push: {
          $mergeObjects: [
            '$$ROOT',
            {
              feedbackToVisitsRatio: {
                $cond: {
                  if: { $eq: ['$$ROOT.visits', 0] },
                  then: null,
                  else: {
                    $divide: [
                      { $add: ['$$ROOT.dyfYes', '$$ROOT.dyfNo'] },
                      '$$ROOT.visits',
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    })
    .exec()
    .then((data) => data && data?.[0]);
}

export async function getAggregatedMetricsWithComparison(
  this: PageMetricsModel,
  dateRange: string,
  comparisonDateRange: string,
  idFilter: { tasks: Types.ObjectId } | { projects: Types.ObjectId },
  pages: IPage[],
): Promise<AggregatedMetricsWithPercentChange | null> {
  const [metrics, comparisonMetrics] = await Promise.all([
    this.getAggregatedMetrics(dateRange, idFilter),
    this.getAggregatedMetrics(comparisonDateRange, idFilter),
  ]);

  if (!metrics) {
    return null;
  }

  const determinePageStatus = (page) => {
    if (page?.is_404) return '404';
    if (page?.redirect) return 'Redirected';
    return 'Live';
  };

  const metricsDict = arrayToDictionary(metrics.visitsByPage || [], '_id');

  const prevMetricsDict = arrayToDictionary(
    comparisonMetrics.visitsByPage || [],
    '_id',
  );

  const visitsByPage = pages
    .map((page) => {
      const metrics = metricsDict[page._id.toString()];
      const prevMetrics = prevMetricsDict[page._id.toString()];

      return {
        ...page,
        ...(metrics || {
          visits: 0,
          dyfYes: 0,
          dyfNo: 0,
          gscTotalClicks: 0,
          gscTotalImpressions: 0,
          gscTotalCtr: 0,
          gscTotalPosition: 0,
          feedbackToVisitsRatio: null,
        }),
        _id: page._id.toString(),
        language: page.lang === 'fr' ? 'French' : 'English',
        is404: page.is_404,
        isRedirect: !!page.redirect,
        pageStatus: determinePageStatus(page),
        visitsPercentChange:
          prevMetrics?.visits && metrics?.visits
            ? percentChange(metrics.visits, prevMetrics.visits)
            : null,
        dyfNoPercentChange:
          prevMetrics?.dyfNo && metrics?.dyfNo
            ? percentChange(metrics.dyfNo, prevMetrics.dyfNo)
            : null,
      };
    })
    .sort((a, b) => a.title?.localeCompare(b.title) || 1);

  const percentChangeIfNotNull = (value: number, comparisonValue: number) =>
    comparisonValue ? percentChange(value, comparisonValue) : null;

  return {
    ...metrics,
    visitsByPage,
    visitsPercentChange: percentChangeIfNotNull(
      metrics.visits,
      comparisonMetrics.visits,
    ),
    gscTotalClicksPercentChange: percentChangeIfNotNull(
      metrics.gscTotalClicks,
      comparisonMetrics.gscTotalClicks,
    ),
    gscTotalImpressionsPercentChange: percentChangeIfNotNull(
      metrics.gscTotalImpressions,
      comparisonMetrics.gscTotalImpressions,
    ),
    gscTotalCtrPercentChange: percentChangeIfNotNull(
      metrics.gscTotalCtr,
      comparisonMetrics.gscTotalCtr,
    ),
    gscTotalPositionPercentChange: percentChangeIfNotNull(
      metrics.gscTotalPosition,
      comparisonMetrics.gscTotalPosition,
    ),
    visitsComparison: comparisonMetrics.visits || 0,
    dyfYesComparison: comparisonMetrics.dyfYes || 0,
    dyfNoComparison: comparisonMetrics.dyfNo || 0,
  };
}

const statics = {
  getAggregatedPageMetrics,
  // toTimeSeries,
  getAggregatedMetrics,
  getAggregatedMetricsWithComparison,
};

PageMetricsSchema.statics = statics;

export type PageMetricsModel = ModelWithStatics<PageMetrics, typeof statics>;
