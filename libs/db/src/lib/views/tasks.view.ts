import {
  type AggregateOptions,
  type ProjectionType,
  type QueryOptions,
  Types,
  type FilterQuery,
  type UpdateOneModel,
  type mongo,
} from 'mongoose';
import { difference, omit, pick } from 'rambdax';
import type { TasksView, TasksViewSchema } from './tasks-view.schema';
import type {
  AttachmentData,
  DateRange,
  GscSearchTermMetrics,
  InternalSearchTerm,
  IProject,
  ITask,
  ITaskView,
  IUxTest,
} from '@dua-upd/types-common';
import {
  $trunc,
  arrayToDictionary,
  arrayToDictionaryMultiref,
  getArraySelectedAbsoluteChange,
  getArraySelectedPercentChange,
  getSelectedAbsoluteChange,
  getSelectedPercentChange,
  isNullish,
  sum,
} from '@dua-upd/utils-common';
import { DbService } from '../db.service';
import { DbViewNew, type ViewConfig } from '../db.views.new';
import { topLevelMetricsGrouping } from './metrics';
import { TaskMetricsStore } from './metrics.store';
import type { PagesView } from './pages-view.schema';

export type TasksViewConfig = ViewConfig<typeof TasksViewSchema>;

/**
 * The base document data that will be passed to the refresh method
 * to generate a single write operation for a view document.
 */
type BaseDoc = Omit<ITask, 'projects' | 'ux_tests'> & {
  projects: IProject[];
  ux_tests: IUxTest[];
  gc_survey_participants: number;
  gc_survey_completed: number;
};

/**
 * The context object that will be passed to the refresh method
 * to be shared between all refresh operations.
 */
type RefreshContext = {
  dateRange: {
    start: Date;
    end: Date;
  };
};

type RefreshWriteOp = {
  updateOne: UpdateOneModel<ITaskView> & { upsert: true };
};

export class TasksViewService extends DbViewNew<
  TasksView,
  typeof TasksViewSchema,
  BaseDoc,
  RefreshContext
> {
  protected readonly refreshFilterProps: (keyof TasksView)[] = [
    'dateRange',
    'pages',
    'task',
    'projects',
  ];

  /**
   * Because metricsByDay takes the longest time to calculate, but also happens to be the most
   * re-usable data, we can take advantage of that by loading it up-front and using it across refreshes.
   *
   * Note that the store must be manually loaded and cleared. It will be automatically used when data is present.
   */
  private readonly metricsByDayStore = new TaskMetricsStore(this.db);

  constructor(
    private db: DbService,
    config: TasksViewConfig,
  ) {
    super(config);
  }

  async loadStoreData() {
    await this.metricsByDayStore.loadData();
  }

  async clearStoreData() {
    this.metricsByDayStore.clearData();
  }

  async prepareRefreshContext(
    filter: FilterQuery<TasksView> & DateRange<Date>,
  ) {
    const tasksCollectionIdFilter = filter.task ? { _id: filter.task } : {};

    const otherCollectionsIdFilter = filter.task ? { tasks: filter.task } : {};

    const [projectsDict, uxTestsDict, gcTasksDict] = await Promise.all([
      this.db.collections.projects
        .find(otherCollectionsIdFilter)
        .lean()
        .exec()
        .then((projects) =>
          arrayToDictionaryMultiref(projects || [], 'tasks', true),
        ),
      this.db.collections.uxTests
        .find(otherCollectionsIdFilter)
        .lean()
        .exec()
        .then((uxTests) =>
          arrayToDictionaryMultiref(uxTests || [], 'tasks', true),
        ),
      this.db.collections.gcTasks
        .getTotalEntries(filter.dateRange)
        .then((gcTasks) => arrayToDictionary(gcTasks || [], 'gc_task')),
    ]);

    const tasks = await this.db.collections.tasks
      .find(tasksCollectionIdFilter)
      .lean()
      .exec()
      .then(
        (tasks) =>
          tasks?.map((task) => {
            const gcTaskParticipants =
              task.gc_tasks
                ?.map((gcTask) => gcTasksDict[gcTask.title])
                .filter(Boolean) || [];

            return {
              ...task,
              projects: projectsDict[task._id.toString()] || [],
              ux_tests: uxTestsDict[task._id.toString()] || [],
              gc_survey_participants: sum(
                gcTaskParticipants.map(({ total_entries }) => total_entries),
              ),
              gc_survey_completed: sum(
                gcTaskParticipants.map(
                  ({ completed_entries }) => completed_entries,
                ),
              ),
            };
          }) || [],
      );
    return {
      baseDocs: tasks,
      ctx: {
        dateRange: filter.dateRange as DateRange<Date>,
      },
    };
  }

  async refresh(task: BaseDoc, { dateRange }: RefreshContext) {
    const dateFilter = {
      date: { $gte: dateRange.start, $lte: dateRange.end },
    };
    const taskFilter = { ...dateFilter, tasks: task._id };

    const [
      topLevelMetrics,
      aaSearchterms,
      gscSearchterms,
      metricsByDay,
      calldriversEnquiry,
      callsByTopic,
      pages,
      numComments,
    ] = await Promise.all([
      this.getTopLevelTaskMetrics({
        tasks: task._id,
        dateRange,
      }),
      this.getTaskAASearchterms({
        tasks: task._id,
        dateRange,
      }),
      this.getTaskGSCSearchterms({
        tasks: task._id,
        dateRange,
      }),
      this.getMetricsByDay(taskFilter),
      this.db.collections.callDrivers.getCallsByEnquiryLine(dateRange, {
        tasks: task._id,
      }),
      this.db.collections.callDrivers.getCallsByTopic(dateRange, {
        tasks: task._id,
      }),
      this.db.views.pages
        .find<Omit<PagesView, 'tasks' | 'projects'>>(
          {
            tasks: task._id,
            dateRange: dateRange,
          },
          {
            tasks: 0,
            projects: 0,
          },
        )
        .then(
          (pages) =>
            pages?.map((page) =>
              pick(
                [
                  '_id',
                  'page',
                  'pageStatus',
                  'visits',
                  'dyf_yes',
                  'dyf_no',
                  'numComments',
                  'gsc_total_clicks',
                  'gsc_total_impressions',
                  'gsc_total_ctr',
                  'gsc_total_position',
                ],
                page,
              ),
            ) || [],
        ),
      this.db.collections.feedback.countDocuments({
        ...dateFilter,
        tasks: task._id,
      }),
    ]);

    const tmf_ranking_index =
      (topLevelMetrics.visits || 0) * 0.1 +
      (topLevelMetrics.totalCalls || 0) * 0.6 +
      (task.gc_survey_participants || 0) * 0.3;

    const taskViewDoc = {
      task: omit(
        [
          'pages',
          'projects',
          'uxTests',
          'gc_survey_participants',
          'gc_survey_completed',
        ],
        task,
      ),
      ...topLevelMetrics,
      aa_searchterms: aaSearchterms,
      gsc_searchterms: gscSearchterms,
      metricsByDay,
      calldriversEnquiry,
      callsByTopic,
      tmf_ranking_index,
      cops: !!task.ux_tests?.find((test) => test.cops),
      numComments,
      survey: task.gc_survey_participants,
      survey_completed: task.gc_survey_completed,
      pages,
      projects: task.projects.map((project) =>
        omit(['pages', 'tasks', 'ux_tests'], project),
      ),
      ux_tests: task.ux_tests.map((uxTest) => omit(['pages', 'tasks'], uxTest)),
      lastUpdated: new Date(),
    } satisfies Omit<ITaskView, '_id' | 'dateRange'>;

    return {
      updateOne: {
        filter: {
          dateRange,
          'task._id': task._id,
        },
        update: {
          $setOnInsert: {
            _id: new Types.ObjectId(),
            dateRange,
          },
          $set: taskViewDoc,
        },
        upsert: true,
      },
    } satisfies RefreshWriteOp;
  }

  private async getTopLevelTaskMetrics(filter: {
    tasks: Types.ObjectId;
    dateRange: DateRange<Date>;
  }) {
    const pageMetrics = ((
      await this.db.views.pages
        .aggregate(filter)
        .project({
          aa_searchterms: 0,
          activity_map: 0,
          gsc_searchterms: 0,
        })
        .group({
          _id: null,
          ...topLevelMetricsGrouping,
        })
        .project({
          _id: 0,
        })
        .exec()
    )?.[0] || {}) as Record<keyof typeof topLevelMetricsGrouping, number>;

    const pageMetricsCamelCase = {
      dyfNo: pageMetrics.dyf_no,
      dyfYes: pageMetrics.dyf_yes,
      visits: pageMetrics.visits,
      dyfNoPerVisit: pageMetrics.visits
        ? pageMetrics.dyf_no / pageMetrics.visits
        : null,
      gscTotalClicks: pageMetrics.gsc_total_clicks,
      gscTotalImpressions: pageMetrics.gsc_total_impressions,
      gscTotalCtr: pageMetrics.gsc_total_ctr,
      gscTotalPosition: pageMetrics.gsc_total_position,
    };

    const totalCalls =
      (
        await this.db.collections.callDrivers
          .aggregate<{ calls: number }>()
          .match({
            tasks: filter.tasks,
            date: { $gte: filter.dateRange.start, $lte: filter.dateRange.end },
          })
          .group({
            _id: null,
            calls: {
              $sum: '$calls',
            },
          })
          .project({
            _id: 0,
          })
          .exec()
      )?.[0]?.calls || 0;

    const callsPerVisit = pageMetrics.visits
      ? totalCalls / pageMetrics.visits
      : null;

    return {
      ...pageMetricsCamelCase,
      totalCalls,
      callsPerVisit,
    };
  }

  private async getTaskAASearchterms(filter: {
    tasks: Types.ObjectId;
    dateRange: DateRange<Date>;
  }) {
    return (
      (await this.db.views.pages
        .aggregate<InternalSearchTerm>(filter)
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
        .limit(100)
        .project({
          _id: 0,
          term: '$_id',
          clicks: 1,
          position: $trunc('$position', 3),
        })
        .exec()) || []
    );
  }

  private async getTaskGSCSearchterms(filter: {
    tasks: Types.ObjectId;
    dateRange: DateRange<Date>;
  }) {
    return (
      (await this.db.views.pages
        .aggregate<GscSearchTermMetrics>(filter)
        .unwind('$gsc_searchterms')
        .group({
          _id: '$gsc_searchterms.term',
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
        .limit(100)
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

  private async getMetricsByDay(filter: {
    tasks: Types.ObjectId;
    date: { $gte: Date; $lte: Date };
  }) {
    const [feedbackByDay, calldriversByDay, pageMetricsByDay] =
      await Promise.all([
        // feedback by day (array)
        this.db.collections.feedback
          .getCommentsByDay(
            { start: filter.date.$gte, end: filter.date.$lte },
            {
              tasks: filter.tasks,
            },
          )
          .then((feedback) =>
            feedback.map(({ date, sum }) => ({
              date: date.toISOString(),
              numComments: sum,
            })),
          ),
        // calldrivers by day (dictionary)
        this.db.collections.callDrivers
          .aggregate<{ date: Date; calls: number }>()
          .match(filter)
          .group({
            _id: '$date',
            calls: {
              $sum: '$calls',
            },
          })
          .project({
            _id: 0,
            date: '$_id',
            calls: 1,
          })
          .sort({ date: 1 })
          .exec()
          .then((calldrivers) =>
            arrayToDictionary(
              calldrivers?.map(({ date, calls }) => ({
                date: date.toISOString(),
                calls,
              })) || [],
              'date',
            ),
          ),
        // page metrics by day (dictionary)
        (this.metricsByDayStore.isLoaded &&
        this.metricsByDayStore.has(filter.tasks, {
          start: filter.date.$gte,
          end: filter.date.$lte,
        })
          ? Promise.resolve(
              this.metricsByDayStore.getMetricsByDay(filter.tasks, {
                start: filter.date.$gte,
                end: filter.date.$lte,
              }),
            )
          : this.db.collections.pageMetrics
              .aggregate<{
                date: Date;
                visits: number;
                dyfNo: number;
                dyfNoPerVisit: number | null;
                dyfYes: number;
              }>()
              .match(filter)
              .group({
                _id: '$date',
                visits: { $sum: '$visits' },
                dyf_no: { $sum: '$dyf_no' },
                dyf_yes: { $sum: '$dyf_yes' },
              })
              .project({
                _id: 0,
                date: '$_id',
                visits: 1,
                dyfNo: '$dyf_no',
                dyfNoPerVisit: {
                  $cond: [
                    { $eq: ['$visits', 0] },
                    null,
                    { $divide: ['$dyf_no', '$visits'] },
                  ],
                },
                dyfYes: '$dyf_yes',
              })
              .exec()
        ).then((pageMetrics) =>
          arrayToDictionary(
            pageMetrics?.map(
              ({ date, visits, dyfNo, dyfNoPerVisit, dyfYes }) => ({
                date: date.toISOString(),
                visits,
                dyfNo,
                dyfNoPerVisit,
                dyfYes,
              }),
            ) || [],
            'date',
          ),
        ),
      ]);

    // iterate over feedback because it already makes sure to include all days
    return feedbackByDay.map((feedback) => {
      const calldrivers = calldriversByDay[feedback.date] || {
        date: feedback.date,
        calls: 0,
      };
      const pageMetrics = pageMetricsByDay[feedback.date] || {
        date: feedback.date,
        visits: 0,
        dyfNo: 0,
        dyfNoPerVisit: null,
        dyfYes: 0,
      };

      const callsPerVisit = pageMetrics.visits
        ? calldrivers.calls / pageMetrics.visits
        : null;

      const commentsPerVisit = pageMetrics.visits
        ? feedback.numComments / pageMetrics.visits
        : null;

      return {
        ...feedback,
        ...calldrivers,
        ...pageMetrics,
        callsPerVisit,
        commentsPerVisit,
      };
    });
  }

  // overriding inherited methods for cleaner types
  override find<ReturnT = TasksView>(
    filter?: FilterQuery<TasksView>,
    projection: ProjectionType<TasksView> = {},
    options: QueryOptions<TasksView> = {},
  ): Promise<ReturnT[] | null> {
    return super.find<ReturnT>(filter, projection, options);
  }

  override findOne<ReturnT = TasksView>(
    filter?: FilterQuery<TasksView>,
    projection: ProjectionType<TasksView> = {},
    options: QueryOptions<TasksView> = {},
  ): Promise<ReturnT | null> {
    return super.findOne<ReturnT>(filter, projection, options);
  }

  override aggregate<T>(
    filter: FilterQuery<TasksView>,
    options?: AggregateOptions,
  ) {
    return super.aggregate<T>(filter, options);
  }

  async getTop50TaskIds(dateRange: { start: Date; end: Date }) {
    return await this._model
      .aggregate<{
        _id: Types.ObjectId;
      }>()
      .match({
        dateRange,
      })
      .sort({
        tmf_ranking_index: -1,
      })
      .limit(50)
      .project({
        _id: '$task._id',
      })
      .exec()
      .then((results) => results.map(({ _id }) => _id.toString()));
  }

  async getTaskMetricsWithComparisons(
    taskId: Types.ObjectId,
    dateRange: DateRange<Date>,
    comparisonDateRange: DateRange<Date>,
  ) {
    type MetricsType = Omit<TasksView, '_id' | 'task' | 'projects'> & {
      _id: string;
      callsPer100Visits: number;
      dyfNoPer1000Visits: number;
      title: string;
      group: string;
      subgroup: string;
      topic: string;
      subtopic: string;
      sub_subtopic: string[];
      user_type: string[];
      tpc_ids: number[];
      program: string;
      service: string;
      user_journey: string[];
      status: string;
      channel: string[];
      core: string[];
      projects: {
        _id: string;
        title: string;
        attachments: AttachmentData[];
      }[];
    };

    const getMetrics = (dateRange: DateRange<Date>) =>
      this.aggregate<MetricsType>({ 'task._id': taskId, dateRange }).addFields({
        _id: {
          $toString: '$task._id',
        },
        callsPer100Visits: {
          $cond: {
            if: { $eq: ['$callsPerVisit', null] },
            then: null,
            else: {
              $multiply: ['$callsPerVisit', 100],
            },
          },
        },
        dyfNoPer1000Visits: {
          $cond: {
            if: { $eq: ['$dyfNoPerVisit', null] },
            then: null,
            else: {
              $multiply: ['$dyfNoPerVisit', 1000],
            },
          },
        },
        title: '$task.title',
        group: '$task.group',
        subgroup: '$task.subgroup',
        topic: '$task.topic',
        subtopic: '$task.subtopic',
        sub_subtopic: '$task.sub_subtopic',
        user_type: '$task.user_type',
        tpc_ids: '$task.tpc_ids',
        program: '$task.program',
        service: '$task.service',
        user_journey: '$task.user_journey',
        status: '$task.status',
        channel: '$task.channel',
        core: '$task.core',
        projects: {
          $map: {
            input: '$projects',
            as: 'project',
            in: {
              _id: '$$project._id',
              title: '$$project.title',
              attachments: '$$project.attachments',
            },
          },
        },
      });

    const [metrics, previousMetrics] = await Promise.all([
      getMetrics(dateRange)
        .exec()
        .then((results) => results?.[0]),
      getMetrics(comparisonDateRange)
        .exec()
        .then((results) => results?.[0]),
    ]);

    if (!metrics) {
      throw Error(
        `Task metrics for task \`${taskId.toString()}\` not found for date range:\n` +
          `start: ${dateRange.start.toISOString()}\n` +
          `end: ${dateRange.end.toISOString()}`,
      );
    }

    const percentChangeProps = [
      'visits',
      'gscTotalClicks',
      'gscTotalImpressions',
      'gscTotalCtr',
      'gscTotalPosition',
      'totalCalls',
      'callsPer100Visits',
      'dyfNoPer1000Visits',
      'numComments',
    ] satisfies (keyof MetricsType)[];

    const metricsWithPercentChange = getSelectedPercentChange(
      percentChangeProps,
      metrics,
      previousMetrics,
    );

    const differenceProps = [
      'callsPer100Visits',
      'dyfNoPer1000Visits',
    ] satisfies (keyof MetricsType)[];

    const metricsWithComparisons = getSelectedAbsoluteChange(
      differenceProps,
      metricsWithPercentChange,
      previousMetrics,
      {
        round: 4,
        suffix: 'Difference',
      },
    );

    const reformatPages = (pages: MetricsType['pages']) =>
      pages
        .map(
          ({
            visits = 0,
            dyf_yes = 0,
            dyf_no = 0,
            numComments = 0,
            page: { _id, title, url, lang, owners, sections },
            pageStatus,
            gsc_total_clicks = 0,
            gsc_total_impressions = 0,
            gsc_total_ctr,
            gsc_total_position,
          }) => ({
            _id: _id.toString(),
            visits,
            dyfYes: dyf_yes,
            dyfNo: dyf_no,
            feedbackToVisitsRatio: visits ? (numComments / visits) * 100 : null,
            title,
            url,
            lang,
            language: lang && (lang === 'en' ? 'English' : 'French'),
            pageStatus,
            gscTotalClicks: gsc_total_clicks,
            gscTotalImpressions: gsc_total_impressions,
            gscTotalCtr: gsc_total_ctr,
            gscTotalPosition: gsc_total_position,
            owners,
            sections,
            numComments,
          }),
        )
        .sort((a, b) => a.title.localeCompare(b.title));

    const metricsByPageComparisonProps = [
      'visits',
      'dyfNo',
      'numComments',
    ] satisfies (keyof ReturnType<typeof reformatPages>[number])[];

    // for charts, get values for both date ranges
    const dateRangeData = {
      calldriversEnquiry: metricsWithComparisons.calldriversEnquiry,
      callsPer100VisitsByDay: metricsWithComparisons.metricsByDay.map(
        ({ date, callsPerVisit }) => ({
          date,
          calls: callsPerVisit && callsPerVisit * 100,
        }),
      ),
      dyfNo: metricsWithComparisons.dyfNo,
      dyfNoPer1000VisitsByDay: metricsWithComparisons.metricsByDay.map(
        ({ date, dyfNoPerVisit }) => ({
          date,
          dyfNo: dyfNoPerVisit && dyfNoPerVisit * 1000,
        }),
      ),
      dyfYes: metricsWithComparisons.dyfYes,
    };

    const comparisonDateRangeData = {
      calldriversEnquiry: previousMetrics.calldriversEnquiry,
      callsPer100VisitsByDay: previousMetrics.metricsByDay.map(
        ({ date, callsPerVisit }) => ({
          date,
          calls: callsPerVisit && callsPerVisit * 100,
        }),
      ),
      dyfNo: previousMetrics.dyfNo,
      dyfNoPer1000VisitsByDay: previousMetrics.metricsByDay.map(
        ({ date, dyfNoPerVisit }) => ({
          date,
          dyfNo: dyfNoPerVisit && dyfNoPerVisit * 1000,
        }),
      ),
      dyfYes: previousMetrics.dyfYes,
    };

    const callsByTopicPercentChange = getArraySelectedPercentChange(
      ['calls'],
      'tpc_id',
      metricsWithPercentChange.callsByTopic,
      previousMetrics.callsByTopic,
    );

    return {
      ...metricsWithComparisons,
      dateRangeData,
      comparisonDateRangeData,
      callsByTopic: getArraySelectedAbsoluteChange(
        ['calls'],
        'tpc_id',
        callsByTopicPercentChange,
        previousMetrics.callsByTopic,
        { suffix: 'Difference' },
      ),
      feedbackByDay: metricsWithPercentChange.metricsByDay.map(
        ({ date, numComments }) => ({
          date,
          numComments,
        }),
      ),
      searchTerms: getArraySelectedPercentChange(
        ['clicks'],
        'term',
        metricsWithPercentChange.aa_searchterms,
        previousMetrics.aa_searchterms,
        { round: 2, suffix: 'Change' },
      ).slice(0, 25),
      // this isn't only visits, but this matches the current property name used in the rest of the code
      visitsByPage: getArraySelectedPercentChange(
        metricsByPageComparisonProps,
        '_id',
        reformatPages(metricsWithPercentChange.pages),
        reformatPages(previousMetrics.pages),
      ),
    };
  }

  async getAllWithComparisons(
    dateRange: DateRange<Date>,
    comparisonDateRange: DateRange<Date>,
  ) {
    type ProjectedTask = {
      _id: Types.ObjectId;
      title: string;
      tmf_ranking_index: number;
      cops: boolean;
      group: string;
      subgroup: string;
      topic: string;
      subtopic: string;
      sub_subtopic: string[];
      program: string;
      service: string;
      user_journey: string[];
      status: string;
      core: string[];
      channel: string[];
      portfolio: string;
      user_type: string[];
      calls: number;
      calls_per_100_visits: number;
      dyf_no: number;
      dyf_no_per_1000_visits: number;
      survey: number;
      survey_completed: number;
      visits: number;
      ux_tests: TasksView['ux_tests'];
    };

    const projection: ProjectionType<TasksView> = {
      _id: '$task._id',
      title: '$task.title',
      tmf_ranking_index: 1,
      cops: 1,
      group: '$task.group',
      subgroup: '$task.subgroup',
      topic: '$task.topic',
      subtopic: '$task.subtopic',
      sub_subtopic: '$task.sub_subtopic',
      program: '$task.program',
      service: '$task.service',
      user_journey: '$task.user_journey',
      status: '$task.status',
      core: '$task.core',
      channel: '$task.channel',
      portfolio: '$task.portfolio',
      user_type: '$task.user_type',
      calls: '$totalCalls',
      calls_per_100_visits: {
        $cond: {
          if: { $eq: ['$callsPerVisit', null] },
          then: null,
          else: {
            $multiply: ['$callsPerVisit', 100],
          },
        },
      },
      dyf_no: '$dyfNo',
      dyf_no_per_1000_visits: {
        $multiply: ['$dyfNoPerVisit', 1000],
      },
      survey: 1,
      survey_completed: {
        $cond: {
          if: { $eq: ['$survey', 0] },
          then: null,
          else: $trunc(
            {
              $divide: ['$survey_completed', '$survey'],
            },
            5,
          ),
        },
      },
      visits: 1,
      ux_tests: 1,
    };

    const [data, comparisonData] = await Promise.all([
      this.aggregate<ProjectedTask>({ dateRange })
        .project(projection)
        .exec()
        .then((results) =>
          results
            .sort((a, b) => {
              const aIfActive =
                a.status === 'Inactive' ? 0 : a.tmf_ranking_index;
              const bIfActive =
                b.status === 'Inactive' ? 0 : b.tmf_ranking_index;
              return bIfActive - aIfActive;
            })
            .map((task, i) => ({
              ...task,
              tmf_rank: i + 1,
              top_task: i < 50,
              secure_portal: !!task.channel.find(
                (channel) => channel === 'Fully online - portal',
              ),
              ux_testing: !!task.ux_tests?.find(
                (test) => !isNullish(test.success_rate),
              ),
            })),
        ),
      this.aggregate<ProjectedTask>({ dateRange: comparisonDateRange })
        .project(projection)
        .exec(),
    ]);

    const comparisonProps = [
      'calls',
      'dyf_no',
      'calls_per_100_visits',
      'dyf_no_per_1000_visits',
    ] satisfies (keyof ProjectedTask)[];

    const dataWithPercentChange = getArraySelectedPercentChange(
      comparisonProps,
      '_id',
      data,
      comparisonData,
      { suffix: '_percent_change', round: 5 },
    );

    return getArraySelectedAbsoluteChange(
      ['calls_per_100_visits', 'dyf_no_per_1000_visits'],
      '_id',
      dataWithPercentChange,
      // Need to cast it to the same type to get the correct type for the return value
      comparisonData,
      { suffix: '_difference' },
    );
  }

  async clearNonExisting(): Promise<mongo.DeleteResult | null> {
    const taskIds = await this.db.collections.tasks
      .distinct('_id')
      .then((ids) => ids.map((id) => id.toString()));

    const viewTaskIds = await this._model
      .distinct('task._id')
      .then((ids) => ids.map((id) => id.toString()));

    const nonExistingIds = difference(viewTaskIds, taskIds);

    if (!nonExistingIds.length) {
      return null;
    }

    return this._model.deleteMany({
      'task._id': { $in: nonExistingIds },
    });
  }
}
