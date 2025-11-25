import {
  type AggregateOptions,
  type FilterQuery,
  type mongo,
  type ProjectionType,
  type QueryOptions,
  Types,
  type UpdateOneModel,
} from 'mongoose';
import { difference, pick } from 'rambdax';
import type {
  ActivityMapMetrics,
  DateRange,
  GscSearchTermMetrics,
  InternalSearchTerm,
  IPage,
  IPageView,
  PageStatus,
} from '@dua-upd/types-common';
import { DbViewNew, ViewConfig } from '../db.views.new';
import { PagesView, PagesViewSchema } from './pages-view.schema';
import { DbService } from '../db.service';
import { topLevelMetricsGrouping } from './metrics';
import {
  $trunc,
  arrayToDictionary,
  getArraySelectedPercentChange,
  isNullish,
  prettyJson,
} from '@dua-upd/utils-common';

export type PagesViewConfig = ViewConfig<typeof PagesViewSchema>;

/**
 * The base document data that will be passed to the refresh method
 * to generate a single write operation for a view document.
 */
type BaseDoc = {
  _id: Types.ObjectId;
  title: string;
  url: string;
  lang: 'en' | 'fr';
  pageStatus: PageStatus;
  redirect: string;
  owners?: string;
  sections?: string;
  tasks: Types.ObjectId[];
  projects: Types.ObjectId[];
};

/**
 * The context object that will be passed to the refresh method
 * to be shared between all refresh operations.
 */
type RefreshContext = {
  dateRange: DateRange<Date>;
  numCommentsByPage: Record<
    string,
    {
      _id: Types.ObjectId;
      numComments: number;
    }
  >;
};

type RefreshWriteOp = {
  updateOne: UpdateOneModel<IPageView> & { upsert: true };
};

// Not an actual Nest service, but couldn't think of a better name
export class PagesViewService extends DbViewNew<
  PagesView,
  typeof PagesViewSchema,
  BaseDoc,
  RefreshContext
> {
  protected readonly refreshFilterProps: (keyof PagesView)[] = [
    'dateRange',
    'page',
    'tasks',
    'projects',
  ];

  constructor(
    private db: DbService,
    config: PagesViewConfig,
  ) {
    super(config);
  }

  // probably just need to adjust this to use the tasks/projects filters if they exist
  async prepareRefreshContext(
    filter: FilterQuery<PagesView> & {
      dateRange: { start: Date; end: Date };
      page?: Types.ObjectId;
      tasks?: Types.ObjectId[];
      projects?: Types.ObjectId[];
    },
  ) {
    const idFilter = pick(['page', 'tasks', 'projects'], filter) as {
      page?: Types.ObjectId;
      tasks?: Types.ObjectId[];
      projects?: Types.ObjectId[];
    };

    if (Object.keys(idFilter).length > 1) {
      throw new Error(
        `PagesView filter must contain only one of page, tasks, or projects. Received: ${prettyJson(
          filter,
        )}`,
      );
    }

    const dateFilter = {
      date: {
        $gte: filter.dateRange.start as Date,
        $lte: filter.dateRange.end as Date,
      },
    };

    const pageIdFilter = idFilter.page
      ? { _id: idFilter.page as Types.ObjectId }
      : idFilter;

    // Filter param is for the view collection, which has a different format for dates.
    // This filter is used for other collections.
    const otherCollectionsFilter: {
      page?: Types.ObjectId;
      date: { $gte: Date; $lte: Date };
    } = { ...idFilter, ...dateFilter };

    const [pages, numCommentsByPage] = await Promise.all([
      // could maybe cache this, seeing as the same data will be used for all pages?
      this.db.collections.pages
        .find(pageIdFilter, {
          url: 1,
          title: 1,
          lang: 1,
          is_404: 1,
          redirect: 1,
          sections: 1,
          owners: 1,
          tasks: 1,
          projects: 1,
        })
        .lean()
        .exec()
        .then((pages) =>
          pages.map((page) => ({
            _id: page._id,
            title: page.title,
            url: page.url,
            lang: page.lang,
            pageStatus: (page.is_404
              ? '404'
              : page.redirect
                ? 'Redirected'
                : 'Live') as PageStatus,
            redirect: page.redirect,
            owners: page.owners,
            sections: page.sections,
            tasks: page.tasks as Types.ObjectId[],
            projects: page.projects as Types.ObjectId[],
          })),
        ),
      this.db.collections.feedback
        .aggregate<{ _id: Types.ObjectId; numComments: number }>()
        .project({ date: 1, page: 1, tasks: 1, projects: 1 })
        .match(otherCollectionsFilter)
        .group({
          _id: '$page',
          numComments: { $sum: 1 },
        })
        .exec()
        .then((feedback) => arrayToDictionary(feedback, '_id')),
    ]);

    return {
      baseDocs: pages,
      ctx: {
        dateRange: {
          start: filter.dateRange.start as Date,
          end: filter.dateRange.end as Date,
        },
        numCommentsByPage,
      },
    };
  }

  async refresh(
    page: BaseDoc,
    { numCommentsByPage, dateRange }: RefreshContext,
  ) {
    const {
      _id,
      title,
      url,
      lang,
      pageStatus,
      redirect,
      owners,
      sections,
      tasks,
      projects,
    } = page;

    const dateFilter = {
      $gte: dateRange.start as Date,
      $lte: dateRange.end as Date,
    };

    // Doing a single query first to prime the db cache for the other queries
    const topLevelMetrics = await this.getTopLevelPageMetrics({
      page: _id,
      date: dateFilter,
    });

    const [aa_searchterms, gsc_searchterms, activity_map] = await Promise.all([
      this.getPageAASearchterms({ page: _id, date: dateFilter }),
      this.getPageGSCSearchterms({ page: _id, date: dateFilter }),
      this.getPageActivityMap({ page: _id, date: dateFilter }),
    ]);

    const insertDoc = {
      page: {
        _id,
        title,
        url,
        lang,
        redirect,
        owners,
        sections,
      } satisfies IPage,
      pageStatus,
      numComments: numCommentsByPage[_id.toString()]?.numComments || 0,
      ...topLevelMetrics,
      aa_searchterms,
      gsc_searchterms,
      activity_map,
      tasks: tasks as Types.ObjectId[],
      projects: projects as Types.ObjectId[],
      lastUpdated: new Date(),
    };

    return {
      updateOne: {
        filter: { 'page._id': _id, dateRange },
        update: {
          $setOnInsert: {
            _id: new Types.ObjectId(),
            dateRange: dateRange,
          },
          $set: insertDoc,
        },
        upsert: true,
      },
    } satisfies RefreshWriteOp;
  }

  private async getTopLevelPageMetrics(filter: {
    page: Types.ObjectId;
    date: { $gte: Date; $lte: Date };
  }): Promise<Record<keyof typeof topLevelMetricsGrouping, number>> {
    return await this.db.collections.pageMetrics
      .aggregate()
      .allowDiskUse(false)
      .match(filter)
      .group({
        _id: null,
        ...topLevelMetricsGrouping,
      })
      .project({
        _id: 0,
      })
      .exec()
      .then((res) => res?.[0] || {});
  }

  private async getPageAASearchterms(filter: {
    page: Types.ObjectId;
    date: { $gte: Date; $lte: Date };
  }) {
    return (
      (await this.db.collections.pageMetrics
        .aggregate<InternalSearchTerm>()
        .allowDiskUse(false)
        .match(filter)
        .project({
          date: 1,
          aa_searchterms: 1,
        })
        .unwind('$aa_searchterms')
        .group({
          _id: {
            $toLower: '$aa_searchterms.term',
          },
          clicks: {
            $sum: '$aa_searchterms.clicks',
          },
          position: {
            $avg: '$aa_searchterms.position',
          },
        })
        .sort({ clicks: -1 })
        .limit(200)
        .project({
          _id: 0,
          term: '$_id',
          clicks: 1,
          position: $trunc('$position', 3),
        })
        .exec()) || []
    );
  }

  private async getPageGSCSearchterms(filter: {
    page: Types.ObjectId;
    date: { $gte: Date; $lte: Date };
  }) {
    return (
      (await this.db.collections.pageMetrics
        .aggregate<GscSearchTermMetrics>()
        .allowDiskUse(false)
        .match(filter)
        .project({
          date: 1,
          gsc_searchterms: 1,
        })
        .unwind('$gsc_searchterms')
        .group({
          _id: {
            $toLower: '$gsc_searchterms.term',
          },
          clicks: {
            $sum: '$gsc_searchterms.clicks',
          },
          ctr: {
            $avg: '$gsc_searchterms.ctr',
          },
          impressions: {
            $sum: '$gsc_searchterms.impressions',
          },
          position: {
            $avg: '$gsc_searchterms.position',
          },
        })
        .sort({ clicks: -1 })
        .limit(200)
        .project({
          _id: 0,
          term: '$_id',
          clicks: 1,
          ctr: $trunc('$ctr', 3),
          impressions: 1,
          position: $trunc('$position', 3),
        })
        .exec()) || []
    );
  }

  private async getPageActivityMap(filter: {
    page: Types.ObjectId;
    date: { $gte: Date; $lte: Date };
  }) {
    return (
      (await this.db.collections.pageMetrics
        .aggregate<ActivityMapMetrics>()
        .allowDiskUse(false)
        .match({
          ...filter,
        })
        .project({
          date: 1,
          activity_map: 1,
        })
        .unwind('$activity_map')
        .group({
          _id: '$activity_map.link',
          clicks: {
            $sum: '$activity_map.clicks',
          },
        })
        .sort({ clicks: -1 })
        .limit(100)
        .project({
          _id: 0,
          link: '$_id',
          clicks: 1,
        })
        .exec()) || []
    );
  }

  // overriding inherited methods for cleaner types
  override async find<ReturnT = PagesView>(
    filter: FilterQuery<PagesView>,
    projection?: ProjectionType<PagesView>,
    options?: QueryOptions<PagesView>,
  ): Promise<ReturnT[] | null> {
    return await super.find<ReturnT>(filter, projection, options);
  }

  override async findOne<ReturnT = PagesView>(
    filter: FilterQuery<PagesView>,
    projection?: ProjectionType<PagesView>,
    options?: QueryOptions<PagesView>,
  ): Promise<ReturnT | null> {
    return await super.findOne<ReturnT>(filter, projection, options);
  }

  override aggregate<T>(
    filter: FilterQuery<PagesView>,
    options?: AggregateOptions,
  ) {
    return super.aggregate<T>(filter, options);
  }

  async getTopVisitedPages(dateRange: DateRange<Date>, limit: number) {
    return this.find(
      { dateRange },
      { url: '$page.url', visits: 1 },
      { sort: { visits: -1 }, limit },
    ) as unknown as Promise<{ url: string; visits: number }[]>;
  }

  async clearNonExisting(): Promise<mongo.DeleteResult | null> {
    const pageIds = await this.db.collections.pages
      .distinct('_id')
      .then((ids) => ids.map((id) => id.toString()));

    const viewPageIds = await this._model
      .distinct('task._id')
      .then((ids) => ids.map((id) => id.toString()));

    const nonExistingIds = difference(viewPageIds, pageIds);

    if (!nonExistingIds.length) {
      return null;
    }

    return this._model.deleteMany({
      'page._id': { $in: nonExistingIds },
    });
  }

  // Methods for API data
  async getPageDetailsData(
    pageId: Types.ObjectId,
    dateRange: DateRange<Date>,
    comparisonDateRange: DateRange<Date>,
  ) {
    // for now, only gsc searchterms, (+top25 increase, top25 decrease), aa searchterms, activity map
    // todo: rest of data that can come from views

    const getData = async (pageId: Types.ObjectId, range: DateRange<Date>) =>
      this.db.views.pages.findOne<
        Pick<
          PagesView,
          | 'page'
          | 'dateRange'
          | 'aa_searchterms'
          | 'gsc_searchterms'
          | 'activity_map'
        >
      >(
        {
          'page._id': pageId,
          dateRange: range,
        },
        {
          page: 1,
          dateRange: 1,
          aa_searchterms: 1,
          gsc_searchterms: 1,
          activity_map: 1,
        },
      );

    const [currentData, comparisonData] = await Promise.all([
      getData(pageId, dateRange),
      getData(pageId, comparisonDateRange),
    ]);

    const aaSearchTerms = currentData?.aa_searchterms
      ? getArraySelectedPercentChange(
          ['clicks'],
          'term',
          currentData?.aa_searchterms,
          comparisonData?.aa_searchterms,
          { suffix: 'Change', round: 3 },
        )
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 10)
      : [];

    const gscSearchTerms = currentData?.gsc_searchterms
      ? getArraySelectedPercentChange(
          ['clicks'],
          'term',
          currentData?.gsc_searchterms,
          comparisonData?.gsc_searchterms,
          { suffix: 'Change', round: 3 },
        )
          .map(
            ({ term, clicks, ctr, impressions, position, clicksChange }) => ({
              term,
              clicks,
              ctr,
              impressions,
              position,
              change: clicksChange,
            }),
          )
          .sort((a, b) =>
            isNullish(b.change) ? -1 : b.change - (a.change || 0),
          )
      : [];

    const top25GSCSearchTerms = gscSearchTerms
      .toSorted((a, b) => b.clicks - a.clicks)
      .slice(0, 25);

    const topIncreasedSearchTerms = gscSearchTerms
      .filter((term) => term.change !== null && term.change > 0)
      .slice(0, 5);

    const topDecreasedSearchTerms = gscSearchTerms
      .filter((term) => term.change !== null && term.change < 0)
      .toReversed()
      .slice(0, 5);

    const activityMap = currentData?.activity_map
      ? getArraySelectedPercentChange(
          ['clicks'],
          'link',
          currentData?.activity_map,
          comparisonData?.activity_map,
          { suffix: 'Change', round: 3 },
        ).sort((a, b) => b.clicks - a.clicks)
      : [];

    return {
      aaSearchTerms,
      top25GSCSearchTerms,
      topIncreasedSearchTerms,
      topDecreasedSearchTerms,
      activityMap,
    };
  }
}
