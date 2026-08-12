import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Types } from 'mongoose';
import type { Cache } from 'cache-manager';
import { DbService } from '@dua-upd/db';
import type {
  ApiParams,
  IReports,
  TaskDetailsData,
  TasksHomeData,
  DateRange,
} from '@dua-upd/types-common';
import {
  dateRangeSplit,
  getHighDemandMetricStats,
  getLatestTaskSuccessRate,
  getSelectedPercentChange,
  parseDateRangeString,
  percentChange,
  type UnwrapPromise,
  type HighDemandMetric,
} from '@dua-upd/utils-common';
import { FeedbackService } from '@dua-upd/api/feedback';
import { omit } from 'rambdax';

const DOCUMENTS_URL = () => process.env.DOCUMENTS_URL || '';

type ViewTaskType = UnwrapPromise<
  ReturnType<DbService['views']['tasks']['getAllWithComparisons']>
>[number];

type TmfCacheValue = {
  tmf_total_tasks: number;
  perf_total_tasks: number;
  highDemandThresholds: Record<HighDemandMetric, number | null>;
  tmfTaskMap: Map<
    string,
    {
      visits_score: number;
      calls_score: number;
      dyf_total_score: number;
      survey_score: number;
      overall_score: number;
      tmf_rank: number;
      performance_score: number | null;
      perf_rank: number | null;

      is_high_demand: boolean;
      high_demand_metrics: HighDemandMetric[];
    }
  >;
};

type HighDemandThresholds = Record<HighDemandMetric, number | null>;

const tasksHomeCacheKey = (
  dateRangeString: string,
  comparisonDateRangeString: string,
) => `getTasksHomeData-${dateRangeString}-${comparisonDateRangeString}`;

const tmfCacheKey = (
  dateRangeString: string,
  comparisonDateRangeString: string,
) => `tmf-${dateRangeString}-${comparisonDateRangeString}`;

@Injectable()
export class TasksService {
  constructor(
    private db: DbService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private feedbackService: FeedbackService,
  ) {}

  async getTasksHomeData(
    dateRangeString: string,
    comparisonDateRangeString: string,
  ): Promise<TasksHomeData> {
    const cacheKey = tasksHomeCacheKey(
      dateRangeString,
      comparisonDateRangeString,
    );

    const cachedData = await this.cacheManager.get<TasksHomeData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const dateRange = parseDateRangeString(dateRangeString);
    const comparisonDateRange = parseDateRangeString(comparisonDateRangeString);

    const {
      totalCalls,
      totalCallsPercentChange,
      totalVisits,
      totalVisitsPercentChange,
    } = await this.getTotalMetricsWithComparison(
      dateRange,
      comparisonDateRange,
    );

    console.time('tasks');

    const tasks = await this.db.views.tasks.getAllWithComparisons(
      dateRange,
      comparisonDateRange,
    );

    console.timeEnd('tasks');

    await this.setTmfCache(dateRangeString, comparisonDateRangeString, tasks);

    const documentsUrl = DOCUMENTS_URL();

    const reports = (await this.db.collections.reports
      .find(
        { type: 'tasks' },
        {
          en_title: 1,
          fr_title: 1,
          en_attachment: 1,
          fr_attachment: 1,
        },
      )
      .exec()
      .then((reports) =>
        reports.map((report) => ({
          ...omit(['_id'], report),
          en_attachment: report.en_attachment?.map((attachment) => ({
            ...attachment,
            storage_url: `${documentsUrl}${attachment.storage_url}`,
          })),
          fr_attachment: report.fr_attachment?.map((attachment) => ({
            ...attachment,
            storage_url: `${documentsUrl}${attachment.storage_url}`,
          })),
        })),
      )) as IReports[];

    const results = {
      dateRange: dateRangeString,
      dateRangeData: tasks.map(omit(['ux_tests'])),
      totalVisits,
      percentChange: totalVisitsPercentChange,
      totalCalls,
      percentChangeCalls: totalCallsPercentChange,
      reports,
    };

    await this.cacheManager.set(cacheKey, results);

    return results;
  }

  private async setTmfCache(
    dateRangeString: string,
    comparisonDateRangeString: string,
    tasks: ViewTaskType[],
  ) {
    const total_tasks = tasks.length;

    const perf_total_tasks = tasks.filter(
      ({ performance_score, historical_average }) => performance_score >= 0 && historical_average >= 0,
    ).length;

    const highDemandStats = getHighDemandMetricStats(tasks);

    const highDemandThresholds: HighDemandThresholds = {
      visits: highDemandStats.visits.p90,
      calls: highDemandStats.calls.p90,
      dyf_no: highDemandStats.dyf_no.p90,
    };

    const isAboveThreshold = (value: number, threshold: number) => {
      return value > threshold;
    };

    const tmfTaskMap = new Map(
      tasks
        .toSorted((a, b) => {
          const aScored =
            a.performance_score != null && a.historical_average != null;
          const bScored =
            b.performance_score != null && b.historical_average != null;

          // unscored tasks always sort after scored tasks
          if (aScored !== bScored) return aScored ? -1 : 1;

          if (!aScored) return a.tmf_rank - b.tmf_rank;

          const scoreDiff = b.performance_score - a.performance_score;

          if (scoreDiff !== 0) return scoreDiff;

          return a.tmf_rank - b.tmf_rank;
        })
        .map((task, index) => {
          const high_demand_metrics: HighDemandMetric[] = [];

          if (isAboveThreshold(task.visits, highDemandThresholds.visits)) {
            high_demand_metrics.push('visits');
          }

          if (isAboveThreshold(task.calls, highDemandThresholds.calls)) {
            high_demand_metrics.push('calls');
          }

          if (isAboveThreshold(task.dyf_no, highDemandThresholds.dyf_no)) {
            high_demand_metrics.push('dyf_no');
          }

          return [
            task._id,
            {
              visits_score: task.visits_score,
              calls_score: task.calls_score,
              dyf_total_score: task.dyf_total_score,
              survey_score: task.survey_score,
              overall_score: task.overall_score,
              tmf_rank: task.tmf_rank,
              performance_score: task.performance_score ?? null,
              perf_rank:
                task.performance_score !== null
                  ? index + 1
                  : null,
              is_high_demand: high_demand_metrics.length > 0,
              high_demand_metrics,
            },
          ];
        }),
    );

    const cacheKey = tmfCacheKey(dateRangeString, comparisonDateRangeString);

    await this.cacheManager.set(cacheKey, {
      tmf_total_tasks: total_tasks,
      perf_total_tasks,
      highDemandThresholds,
      tmfTaskMap,
    } satisfies TmfCacheValue);
  }

  private async getCachedTmfData(
    taskId: string,
    dateRangeString: string,
    comparisonDateRangeString: string,
  ) {
    if (
      !(await this.cacheManager.stores[0].has(
        tasksHomeCacheKey(dateRangeString, comparisonDateRangeString),
      ))
    ) {
      console.log(
        `Cache miss for tasks home data for date range ${dateRangeString} and comparison date range ${comparisonDateRangeString}. Fetching and caching data...`,
      );
      await this.getTasksHomeData(dateRangeString, comparisonDateRangeString);
    }

    const cachedDateRangeData = await this.cacheManager.get<TmfCacheValue>(
      tmfCacheKey(dateRangeString, comparisonDateRangeString),
    );

    // in theory, this should never actually happen
    if (!cachedDateRangeData) {
      throw new Error(
        `No cached TMF data found for date range ${dateRangeString} and comparison date range ${comparisonDateRangeString}`,
      );
    }

    const taskData = cachedDateRangeData.tmfTaskMap.get(taskId);

    // this shouldn't happen either, unless the task id isn't valid, in which case an error should already be thrown
    if (!taskData) {
      throw new Error(
        `No cached TMF data found for task id ${taskId} in date range ${dateRangeString} and comparison date range ${comparisonDateRangeString}`,
      );
    }

    return {
      ...taskData,
      tmf_total_tasks: cachedDateRangeData.tmf_total_tasks,
      perf_total_tasks: cachedDateRangeData.perf_total_tasks,
      highDemandThresholds: cachedDateRangeData.highDemandThresholds,
    };
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
    if (!params || !params.id) {
      throw Error(
        'Attempted to get Task details from API but no id was provided.',
      );
    }

    if (!params.comparisonDateRange) {
      throw Error(
        'Attempted to get Task details from API but no comparisonDateRange was provided.',
      );
    }

    const cacheKey = `getTaskDetails-${params.id}-${params.dateRange}-${params.comparisonDateRange}`;
    const cachedData = await this.cacheManager.get<TaskDetailsData>(cacheKey);

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

    const tmfData = await this.getCachedTmfData(
      params.id,
      params.dateRange,
      params.comparisonDateRange,
    );

    const commentsAndWords = await this.feedbackService.getCommentsAndWords({
      dateRange: parseDateRangeString(params.dateRange),
      type: 'task',
      id: params.id,
    });

    const { start: prevDateRangeStart, end: prevDateRangeEnd } =
      parseDateRangeString(params.comparisonDateRange);

    const numComments =
      commentsAndWords.en.comments.length + commentsAndWords.fr.comments.length;

    const numPreviousComments = await this.db.collections.feedback
      .countDocuments({
        date: { $gte: prevDateRangeStart, $lte: prevDateRangeEnd },
        tasks: taskId,
      })
      .exec();

    const numCommentsPercentChange =
      numPreviousComments && !Number.isNaN(numPreviousComments)
        ? percentChange(numComments, numPreviousComments)
        : null;

    const uxTests = taskData.ux_tests
      ?.map((uxTest) => ({
        _id: uxTest._id,
        _project_id: uxTest.project,
        title: uxTest.title,
        date: uxTest.date,
        test_type: uxTest.test_type,
        success_rate: uxTest.success_rate,
        total_users: uxTest.total_users,
        scenario: uxTest.scenario,
        scenario_html: uxTest.scenario_html,
      }))
      .sort((a, b) => {
        // send null dates to the end of the list
        if ((a.date || Infinity) < (b.date || Infinity)) return 1;
        if ((a.date || Infinity) > (b.date || Infinity)) return -1;
        return 0;
      });

    const taskSuccessByUxTest = uxTests || [];

    const {
      avgTestSuccess: avgTaskSuccessFromLastTest,
      latestDate: dateFromLastTest,
      percentChange: avgSuccessPercentChange,
      valueChange: avgSuccessValueChange,
    } = getLatestTaskSuccessRate(uxTests || []);

    const returnData = {
      ...omit(['ux_tests'], taskData),
      ...tmfData,
      dateRange: params.dateRange,
      comparisonDateRange: params.comparisonDateRange,
      taskSuccessByUxTest,
      avgTaskSuccessFromLastTest,
      avgSuccessPercentChange,
      avgSuccessValueChange,
      dateFromLastTest,
      commentsAndWords,
      numComments,
      numCommentsPercentChange,
    } satisfies TaskDetailsData;

    await this.cacheManager.set(cacheKey, returnData);

    return returnData;
  }
}
