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
  getAvgSuccessFromLatestTests,
  getLatestTaskSuccessRate,
  getSelectedPercentChange,
  parseDateRangeString,
  percentChange,
  addTmfScoresToTasks,
} from '@dua-upd/utils-common';
import { FeedbackService } from '@dua-upd/api/feedback';
import { omit } from 'rambdax';
import { compressString, decompressString } from '@dua-upd/node-utils';

const DOCUMENTS_URL = () => process.env.DOCUMENTS_URL || '';

type CachedTaskTmfRanking = {
  taskId: string;
  visits_score: number;
  calls_score: number;
  dyf_total_score: number;
  survey_score: number;
  overall_score: number;
  tmf_rank: number;
  tmf_total_tasks: number;
  performance_score: number | null;
  perf_rank: number | null;
  perf_total_tasks: number;
};

type TmfRankedTaskLike = {
  _id?: unknown;
  task?: {
    _id?: unknown;
  };
  visits_score?: number;
  calls_score?: number;
  dyf_total_score?: number;
  survey_score?: number;
  overall_score?: number;
  tmf_rank?: number;
  performance_score?: number | null;
};

@Injectable()
export class TasksService {
  private readonly tmfRankingCache = new Map<
    string,
    Map<string, CachedTaskTmfRanking>
  >();

  constructor(
    private db: DbService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private feedbackService: FeedbackService,
  ) {}

  async getTasksHomeData(
    dateRange: string,
    comparisonDateRange: string,
  ): Promise<TasksHomeData> {
    const cacheKey = this.getTasksHomeDataCacheKey(
      dateRange,
      comparisonDateRange,
    );

    const cachedData = await this.cacheManager.get<string>(cacheKey).then(
      async (cachedData) =>
        cachedData &&
        // it's actually still a string here, but we want to avoid deserializing it
        // and then reserializing it to send over http while still keeping our types intact
        ((await decompressString(cachedData)) as unknown as TasksHomeData),
    );

    if (cachedData) {
      return cachedData;
    }

    const { start, end, comparisonStart, comparisonEnd } =
      this.parseTasksHomeDateRanges(dateRange, comparisonDateRange);

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

    const tasksWithTmf = await this.getTasksWithTmfAndPrimeCache(
      dateRange,
      comparisonDateRange,
    );

    const tasks = tasksWithTmf.map((task) => {
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
    });

    console.timeEnd('tasks');

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

  private async getTasksWithTmfAndPrimeCache(
    dateRange: string,
    comparisonDateRange: string,
  ) {
    const { start, end, comparisonStart, comparisonEnd } =
      this.parseTasksHomeDateRanges(dateRange, comparisonDateRange);

    const tasks = await this.db.views.tasks.getAllWithComparisons(
      { start, end },
      { start: comparisonStart, end: comparisonEnd },
    );

    const tasksWithTmf = addTmfScoresToTasks(tasks);

    this.setTmfRankingsCache(
      dateRange,
      comparisonDateRange,
      tasksWithTmf as TmfRankedTaskLike[],
    );

    return tasksWithTmf;
  }

  private async primeTmfRankingCache(
    dateRange: string,
    comparisonDateRange: string,
  ): Promise<void> {
    if (this.hasTmfRankingCache(dateRange, comparisonDateRange)) {
      return;
    }

    const cachedHomeData = await this.getParsedCachedTasksHomeData(
      dateRange,
      comparisonDateRange,
    );

    if (cachedHomeData) {
      this.setTmfRankingsCache(
        dateRange,
        comparisonDateRange,
        cachedHomeData.dateRangeData as TmfRankedTaskLike[],
      );

      if (this.hasTmfRankingCache(dateRange, comparisonDateRange)) {
        return;
      }
    }

    await this.getTasksWithTmfAndPrimeCache(dateRange, comparisonDateRange);
  }

  private getTmfRankingFromCache(
    dateRange: string,
    comparisonDateRange: string,
    taskId: string,
  ): CachedTaskTmfRanking | undefined {
    return this.tmfRankingCache
      .get(this.getTmfRankingCacheKey(dateRange, comparisonDateRange))
      ?.get(taskId);
  }

  private hasTmfRankingCache(
    dateRange: string,
    comparisonDateRange: string,
  ): boolean {
    return this.tmfRankingCache.has(
      this.getTmfRankingCacheKey(dateRange, comparisonDateRange),
    );
  }

  private setTmfRankingsCache(
    dateRange: string,
    comparisonDateRange: string,
    tasks: TmfRankedTaskLike[],
  ): void {
    const tmfTotalTasks = tasks.length;
    const performanceRankByTaskId = this.getPerformanceRankByTaskId(tasks);
    const perfTotalTasks = performanceRankByTaskId.size;

    const rankings = tasks
      .map((task) => {
        const taskId = this.getTaskIdForTmfCache(task);

        return this.toCachedTmfRanking(
          task,
          tmfTotalTasks,
          taskId ? (performanceRankByTaskId.get(taskId) ?? null) : null,
          perfTotalTasks,
        );
      })
      .filter((ranking): ranking is CachedTaskTmfRanking => Boolean(ranking));

    if (rankings.length === 0 && tasks.length > 0) {
      return;
    }

    this.tmfRankingCache.set(
      this.getTmfRankingCacheKey(dateRange, comparisonDateRange),
      new Map(rankings.map((ranking) => [ranking.taskId, ranking])),
    );
  }

  private toCachedTmfRanking(
    task: TmfRankedTaskLike,
    tmfTotalTasks: number,
    perfRank: number | null,
    perfTotalTasks: number,
  ): CachedTaskTmfRanking | null {
    const taskId = this.getTaskIdForTmfCache(task);

    if (!taskId) {
      return null;
    }

    const {
      visits_score,
      calls_score,
      dyf_total_score,
      survey_score,
      overall_score,
      tmf_rank,
    } = task;

    if (
      typeof visits_score !== 'number' ||
      typeof calls_score !== 'number' ||
      typeof dyf_total_score !== 'number' ||
      typeof survey_score !== 'number' ||
      typeof overall_score !== 'number' ||
      typeof tmf_rank !== 'number'
    ) {
      return null;
    }

    return {
      taskId,
      visits_score,
      calls_score,
      dyf_total_score,
      survey_score,
      overall_score,
      tmf_rank,
      tmf_total_tasks: tmfTotalTasks,
      performance_score: this.getPerformanceScore(task),
      perf_rank: perfRank,
      perf_total_tasks: perfTotalTasks,
    };
  }

  private getTaskIdForTmfCache(task: TmfRankedTaskLike): string | null {
    const taskId = task.task?._id ?? task._id;

    return taskId ? String(taskId) : null;
  }

  private getTmfRankingCacheKey(
    dateRange: string,
    comparisonDateRange: string,
  ): string {
    return `taskTmfRanking-${dateRange}-${comparisonDateRange}`;
  }

  private getTasksHomeDataCacheKey(
    dateRange: string,
    comparisonDateRange: string,
  ): string {
    return `getTasksHomeData-${dateRange}-${comparisonDateRange}`;
  }

  private async getParsedCachedTasksHomeData(
    dateRange: string,
    comparisonDateRange: string,
  ): Promise<TasksHomeData | null> {
    const cacheKey = this.getTasksHomeDataCacheKey(
      dateRange,
      comparisonDateRange,
    );

    const cachedData = await this.cacheManager.get<string>(cacheKey);

    if (!cachedData) {
      return null;
    }

    try {
      return JSON.parse(await decompressString(cachedData)) as TasksHomeData;
    } catch {
      return null;
    }
  }

  private parseTasksHomeDateRanges(
    dateRange: string,
    comparisonDateRange: string,
  ) {
    const [start, end] = dateRange.split('/').map((d) => new Date(d));

    const [comparisonStart, comparisonEnd] = comparisonDateRange
      .split('/')
      .map((d) => new Date(d));

    return {
      start,
      end,
      comparisonStart,
      comparisonEnd,
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
    if (!params.id) {
      throw Error(
        'Attempted to get Task details from API but no id was provided.',
      );
    }

    const cacheKey = `getTaskDetails-${params.id}-${params.dateRange}-${params.comparisonDateRange}`;
    const cachedData =
      await this.cacheManager.get<TaskDetailsData>(cacheKey);

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

    await this.primeTmfRankingCache(
      params.dateRange,
      params.comparisonDateRange,
    );

    const tmfRanking = this.getTmfRankingFromCache(
      params.dateRange,
      params.comparisonDateRange,
      params.id,
    );

    const { taskId: _taskTmfId, ...tmfScoresAndRank } = tmfRanking ?? {};

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
      .map((uxTest) => ({
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
      ...tmfScoresAndRank,
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
    };

    // await this.cacheManager.set(cacheKey, returnData);

    return returnData;
  }

  private getPerformanceRankByTaskId(
    tasks: TmfRankedTaskLike[],
  ): Map<string, number> {
    const rankedPerformanceTasks = tasks
      .map((task) => ({
        taskId: this.getTaskIdForTmfCache(task),
        performanceScore: this.getPerformanceScore(task),
        tmfRank:
          typeof task.tmf_rank === 'number'
            ? task.tmf_rank
            : Number.POSITIVE_INFINITY,
      }))
      .filter(
        (
          task,
        ): task is {
          taskId: string;
          performanceScore: number;
          tmfRank: number;
        } => !!task.taskId && task.performanceScore !== null,
      )
      .sort((a, b) => {
        const scoreDiff = b.performanceScore - a.performanceScore;

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return a.tmfRank - b.tmfRank;
      });

    return new Map(
      rankedPerformanceTasks.map((task, index) => [task.taskId, index + 1]),
    );
  }

  private getPerformanceScore(task: TmfRankedTaskLike): number | null {
    return typeof task.performance_score === 'number' &&
      Number.isFinite(task.performance_score)
      ? task.performance_score
      : null;
  }
}
