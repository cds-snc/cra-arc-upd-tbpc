import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Cache } from 'cache-manager';
import type {
  CallDriverModel,
  FeedbackModel,
  PageDocument,
  PageMetricsModel,
  ProjectDocument,
  TaskDocument,
  UxTestDocument,
} from '@dua-upd/db';
import {
  CallDriver,
  DbService,
  Feedback,
  GcTasks,
  Page,
  PageMetrics,
  Project,
  Reports,
  Task,
  UxTest,
} from '@dua-upd/db';
import type {
  ApiParams,
  IReports,
  TaskDetailsData,
  TasksHomeData,
  DateRange,
} from '@dua-upd/types-common';
import {
  dateRangeSplit,
  getAvgSuccessFromLatestTests,
  getLatestTaskSuccessRate,
  getSelectedPercentChange,
  parseDateRangeString,
  percentChange,
} from '@dua-upd/utils-common';
import { FeedbackService } from '@dua-upd/api/feedback';
import { omit } from 'rambdax';
import { compressString, decompressString } from '@dua-upd/node-utils';

@Injectable()
export class TasksService {
  constructor(
    private db: DbService,
    @InjectModel(Project.name, 'defaultConnection')
    private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name, 'defaultConnection')
    private taskModel: Model<TaskDocument>,
    @InjectModel(UxTest.name, 'defaultConnection')
    private uxTestModel: Model<UxTestDocument>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: PageMetricsModel,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedbackModel: FeedbackModel,
    @InjectModel(CallDriver.name, 'defaultConnection')
    private calldriversModel: CallDriverModel,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
    @InjectModel(Reports.name, 'defaultConnection')
    private reportsModel: Model<Reports>,
    @InjectModel(GcTasks.name, 'defaultConnection')
    private gcTasksModel: Model<GcTasks>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private feedbackService: FeedbackService,
  ) {}

  async getTasksHomeData(
    dateRange: string,
    comparisonDateRange: string,
  ): Promise<TasksHomeData> {
    const cacheKey = `getTasksHomeData-${dateRange}-${comparisonDateRange}`;

    const cachedData = await this.cacheManager.store.get<string>(cacheKey).then(
      async (cachedData) =>
        cachedData &&
        // it's actually still a string here, but we want to avoid deserializing it
        // and then reserializing it to send over http while still keeping our types intact
        ((await decompressString(cachedData)) as unknown as TasksHomeData),
    );

    if (cachedData) {
      return cachedData;
    }

    const [start, end] = dateRange.split('/').map((d) => new Date(d));

    const [comparisonStart, comparisonEnd] = comparisonDateRange
      .split('/')
      .map((d) => new Date(d));

    const queryDateRange = {
      start,
      end,
    };

    const queryComparisonDateRange = {
      start: comparisonStart,
      end: comparisonEnd,
    };

    const {
      totalCalls,
      totalCallsPercentChange,
      totalVisits,
      totalVisitsPercentChange,
    } = await this.getTotalMetricsWithComparison(
      queryDateRange,
      queryComparisonDateRange,
    );

    console.time('tasks');
    const tasks = await this.db.views.tasks
      .getAllWithComparisons(
        { start, end },
        { start: comparisonStart, end: comparisonEnd },
      )
      .then((tasks) =>
        tasks.map((task) => {
          const { avgTestSuccess, percentChange: latest_success_rate } =
            getAvgSuccessFromLatestTests(task.ux_tests);

          const latest_success_rate_percent_change = percentChange(
            avgTestSuccess,
            avgTestSuccess - latest_success_rate,
          );

          const latest_success_rate_difference = latest_success_rate * 100;

          return {
            ...task,
            latest_ux_success: avgTestSuccess,
            latest_success_rate_difference,
            latest_success_rate_percent_change,
          };
        }),
      );
    console.timeEnd('tasks');

    const reports = (await this.reportsModel
      .find(
        { type: 'tasks' },
        {
          _id: 0,
          en_title: 1,
          fr_title: 1,
          en_attachment: 1,
          fr_attachment: 1,
        },
      )
      .exec()) as IReports[];

    const results = {
      dateRange,
      dateRangeData: tasks.map(omit(['ux_tests'])),
      totalVisits,
      percentChange: totalVisitsPercentChange,
      totalCalls,
      percentChangeCalls: totalCallsPercentChange,
      reports,
    };

    await this.cacheManager.set(
      cacheKey,
      await compressString(JSON.stringify(results)),
    );

    return results;
  }

  async getTotalMetricsWithComparison(
    dateRange: DateRange<Date>,
    comparisonDateRange: DateRange<Date>,
  ) {
    console.time('totalMetrics');

    const [totalCalls, totalVisits, previousCalls, previousVisits] =
      await Promise.all([
        this.db.collections.callDrivers
          .aggregate<{ totalCalls: number }>()
          .match({
            tasks: { $elemMatch: { $exists: true } },
            date: { $gte: dateRange.start, $lte: dateRange.end },
          })
          .group({
            _id: null,
            totalCalls: {
              $sum: '$calls',
            },
          })
          .then((results) => results?.[0]?.totalCalls),
        this.db.views.pages
          .aggregate<{ totalVisits: number }>({
            dateRange,
            'tasks.0': { $exists: true },
          })
          .group({
            _id: null,
            totalVisits: {
              $sum: '$visits',
            },
          })
          .then((results) => results?.[0]?.totalVisits),

        this.db.collections.callDrivers
          .aggregate<{ totalCalls: number }>()
          .match({
            tasks: { $elemMatch: { $exists: true } },
            date: {
              $gte: comparisonDateRange.start,
              $lte: comparisonDateRange.end,
            },
          })
          .group({
            _id: null,
            totalCalls: {
              $sum: '$calls',
            },
          })
          .then((results) => results?.[0]?.totalCalls),
        this.db.views.pages
          .aggregate<{ totalVisits: number }>({
            dateRange: comparisonDateRange,
            'tasks.0': { $exists: true },
          })
          .group({
            _id: null,
            totalVisits: {
              $sum: '$visits',
            },
          })
          .then((results) => results?.[0]?.totalVisits),
      ]);
    console.timeEnd('totalMetrics');

    return getSelectedPercentChange(
      ['totalCalls', 'totalVisits'],
      { totalCalls, totalVisits },
      { totalCalls: previousCalls, totalVisits: previousVisits },
    );
  }

  async getTaskDetails(params: ApiParams): Promise<TaskDetailsData> {
    if (!params.id) {
      throw Error(
        'Attempted to get Task details from API but no id was provided.',
      );
    }

    const cacheKey = `getTaskDetails-${params.id}-${params.dateRange}-${params.comparisonDateRange}`;
    const cachedData =
      await this.cacheManager.store.get<TaskDetailsData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const taskId = new Types.ObjectId(params.id);

    const [start, end] = dateRangeSplit(params.dateRange);

    const [prevStart, prevEnd] = dateRangeSplit(params.comparisonDateRange);

    const taskData = await this.db.views.tasks.getTaskMetricsWithComparisons(
      taskId,
      { start, end },
      { start: prevStart, end: prevEnd },
    );

    const mostRelevantCommentsAndWords =
      await this.feedbackService.getMostRelevantCommentsAndWords({
        dateRange: parseDateRangeString(params.dateRange),
        type: 'task',
        id: params.id,
      });

    const uxTests = taskData.ux_tests
      .map((uxTest) => ({
        _id: uxTest._id,
        _project_id: uxTest.project,
        title: uxTest.title,
        date: uxTest.date,
        test_type: uxTest.test_type,
        success_rate: uxTest.success_rate,
        total_users: uxTest.total_users,
        scenario: uxTest.scenario,
      }))
      .sort((a, b) => {
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
      });

    const taskSuccessByUxTest = uxTests;

    const {
      avgTestSuccess: avgTaskSuccessFromLastTest,
      latestDate: dateFromLastTest,
      percentChange: avgSuccessPercentChange,
      valueChange: avgSuccessValueChange,
    } = getLatestTaskSuccessRate(uxTests);

    const returnData = {
      ...omit(['ux_tests'], taskData),
      dateRange: params.dateRange,
      comparisonDateRange: params.comparisonDateRange,
      taskSuccessByUxTest,
      avgTaskSuccessFromLastTest,
      avgSuccessPercentChange,
      avgSuccessValueChange,
      dateFromLastTest,
      mostRelevantCommentsAndWords,
    };

    await this.cacheManager.set(cacheKey, returnData);

    return returnData;
  }
}
