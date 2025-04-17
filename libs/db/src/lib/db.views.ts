import { Model, mongo, PipelineStage, Schema, Types } from 'mongoose';
import dayjs, { ManipulateType } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  arrayToDictionary,
  sum,
} from '@dua-upd/utils-common';
import { Page, PageMetrics, Task } from '../';
import type { DateRange, IPage } from '@dua-upd/types-common';

dayjs.extend(utc);

/**
 * classes for defining of on-demand materialized views
 */

export interface DbViewType {
  _id: DateRange<string | Date>;
  lastUpdated: Date;
}

export interface DbViewConfig<T extends DbViewType, Source> {
  collectionName: `view_${string}`;
  sourceModel: Model<Source>;
  model: Model<T>;
  pipelineCreator: (dateRange: DateRange<string | Date>) => PipelineStage[];
  maxAge: [number, ManipulateType];
}

export abstract class DbView<
  T extends DbViewType & { lastUpdated: Date },
  Source,
> {
  collectionName: `view_${string}`;
  sourceModel: Model<Source>;
  model: Model<T>;
  pipelineCreator: (dateRange: DateRange<string | Date>) => PipelineStage[];
  maxAge: [number, ManipulateType];

  protected constructor(config: DbViewConfig<T, Source>) {
    this.collectionName = config.collectionName;
    this.sourceModel = config.sourceModel;
    this.model = config.model;
    this.pipelineCreator = config.pipelineCreator;
    this.maxAge = config.maxAge;
  }

  private async getLastUpdated(dateRange: DateRange<string | Date>) {
    const results = (await this.model
      .findOne(
        {
          _id: {
            start: new Date(dateRange.start),
            end: new Date(dateRange.end),
          },
        },
        { lastUpdated: 1 },
      )
      .lean()
      .exec()) as T | null;

    return results?.lastUpdated || null;
  }

  private async needsUpdate(dateRange: DateRange<string | Date>) {
    const lastUpdated = await this.getLastUpdated(dateRange);

    if (!lastUpdated) {
      return true;
    }

    const expiryDate = dayjs.utc(lastUpdated).add(...this.maxAge);

    return dayjs.utc().isAfter(expiryDate);
  }

  async getOrUpdate(dateRange: DateRange<string | Date>, forceUpdate = false) {
    if ((await this.needsUpdate(dateRange)) || forceUpdate) {
      await this.sourceModel
        .aggregate<T>(this.pipelineCreator(dateRange))
        .exec();
    }

    const queryId = {
      start: new Date(dateRange.start),
      end: new Date(dateRange.end),
    };

    return (await this.model.findOne({ _id: queryId }).lean().exec()) as T;
  }

  async clearAll(): Promise<mongo.DeleteResult> {
    return this.model.deleteMany({});
  }
}

const viewsBaseSchema = {
  _id: {
    start: Date,
    end: Date,
  },
  lastUpdated: Date,
};

// Page Visits view, for aggregating individual page visits over a date range

export interface PageVisits extends DbViewType {
  // the _id in the pageVisits objects are Page references and not ids from pages_metrics
  pageVisits: (IPage & { visits: number, dyf_no: number })[];
}

const COLLECTION_NAME = 'view_page_visits' as const;

export class PageVisitsView
  extends DbView<PageVisits, PageMetrics>
  implements DbViewConfig<PageVisits, PageMetrics>
{
  constructor(
    pageVisitsModel: Model<PageVisits>,
    pageMetricsModel: Model<PageMetrics>,
  ) {
    const collectionName = COLLECTION_NAME;
    const maxAge: [number, ManipulateType] = [1, 'week'];
    const sourceModel = pageMetricsModel;
    const model = pageVisitsModel;
    const pipelineCreator = (dateRange: DateRange<string | Date>) => [
      {
        $match: {
          date: {
            $gte: new Date(dateRange.start),
            $lte: new Date(dateRange.end),
          },
          page: {
            $exists: true,
          },
        },
      },
      {
        $project: {
          page: 1,
          visits: 1,
          dyf_no: 1,
        },
      },
      {
        $group: {
          _id: '$page',
          visits: {
            $sum: '$visits',
          },
          dyf_no: {
            $sum: '$dyf_no',
          },
        },
      },
      {
        $sort: {
          visits: -1 as const,
        },
      },
      {
        $group: {
          _id: null,
          pageVisits: {
            $push: '$$ROOT',
          },
        },
      },
      {
        $project: {
          _id: {
            start: new Date(dateRange.start),
            end: new Date(dateRange.end),
          },
          pageVisits: '$pageVisits',
          lastUpdated: '$$NOW',
        },
      },
      {
        $merge: {
          into: COLLECTION_NAME,
          on: '_id',
        },
      },
    ];

    super({
      collectionName,
      maxAge,
      sourceModel,
      model,
      pipelineCreator,
    });
  }

  async getVisitsWithPageData(
    dateRange: DateRange<string | Date>,
    pageModel: Model<Page>,
  ) {
    const visits = (await this.getOrUpdate(dateRange))?.pageVisits || [];

    const visitsDictionary = arrayToDictionary(visits, '_id');

    const pagesProjection = {
      url: 1,
      title: 1,
      tasks: 1,
      projects: 1,
      ux_tests: 1,
      is_404: {
        $toBool: '$is_404',
      },
      redirect: 1,
      is_redirect: {
        $toBool: '$redirect',
      },
      pageStatus: {
        $switch: {
          branches: [
            { case: { $eq: ['$is_404', true] }, then: '404' },
            { case: { $eq: ['$redirect', ''] }, then: 'Live' },
            {
              case: { $eq: [{ $toBool: '$redirect' }, true] },
              then: 'Redirected',
            },
          ],
          default: 'Live',
        },
      },
    };

    const pages =
      (await pageModel.find({}, pagesProjection).lean().exec()) || [];

    return pages
      .map((page) => ({
        ...page,
        visits: visitsDictionary[page._id.toString()]?.visits || 0,
      }))
      .sort((a, b) => b.visits - a.visits);
  }

  async getVisitsDyfNoWithTaskData(
    dateRange: DateRange<string | Date>,
    taskModel: Model<Task>,
  ) {
    const visits = (await this.getOrUpdate(dateRange))?.pageVisits || [];

    const visitsDictionary = arrayToDictionary(visits, '_id');

    const tasks = (await taskModel.find().exec()) || [];

    const tasksWithVisits = await Promise.all(
      tasks.map((task) =>
        task.populate('pages').then((task) => {
          const pageVisits =
            task.pages?.map(
              (page) => visitsDictionary[page._id.toString()]?.visits || 0,
            ) || [];

          const dyfNo =
            task.pages?.map(
              (page) => visitsDictionary[page._id.toString()]?.dyf_no || 0,
            ) || [];

          return {
            ...task.toObject(),
            visits: sum(pageVisits),
            dyf_no: sum(dyfNo),
          };
        }),
      ),
    );

    return tasksWithVisits.sort((a, b) => b.visits - a.visits);
  }
}

export const PageVisitsViewSchema = new Schema<PageVisits>(
  {
    ...viewsBaseSchema,
    pageVisits: [{ _id: Types.ObjectId, visits: Number, dyf_no: Number}],
  },
  { collection: COLLECTION_NAME },
);

PageVisitsViewSchema.index({ _id: 'hashed' });
