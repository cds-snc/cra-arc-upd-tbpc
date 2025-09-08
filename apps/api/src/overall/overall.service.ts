import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Cache } from 'cache-manager';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import type { FilterQuery, Model } from 'mongoose';
import { omit, pick } from 'rambdax';
import type {
  CallDriverModel,
  OverallDocument,
  ProjectDocument,
  TaskDocument,
  UxTestDocument,
  PageMetricsModel,
  PageDocument,
  SearchAssessmentDocument,
  AnnotationsDocument,
  FeedbackModel,
  GcTasksModel,
} from '@dua-upd/db';
import {
  DbService,
  CallDriver,
  Overall,
  Project,
  Task,
  UxTest,
  Feedback,
  PageMetrics,
  Page,
  SearchAssessment,
  Annotations,
  GcTasks,
} from '@dua-upd/db';
import type {
  ApiParams,
  ProjectsHomeData,
  OverviewAggregatedData,
  OverviewData,
  OverviewUxData,
  OverviewProjectData,
  OverviewProject,
  OverallSearchTerm,
  PartialOverviewFeedback,
  ChunkedMostRelevantCommentsAndWords,
} from '@dua-upd/types-common';
import {
  $trunc,
  arrayToDictionary,
  AsyncLogTiming,
  avg,
  chunkMap,
  dateRangeSplit,
  getAvgSuccessFromLatestTests,
  getImprovedKpiSuccessRates,
  getImprovedKpiTopSuccessRates,
  getLatestTestData,
  getStructuredDateRangesWithComparison,
  parseDateRangeString,
  percentChange,
} from '@dua-upd/utils-common';
import { FeedbackService } from '@dua-upd/api/feedback';
import { compressString, decompressString } from '@dua-upd/node-utils';

dayjs.extend(utc);
dayjs.extend(quarterOfYear);

const projectStatusSwitchExpression = {
  $switch: {
    branches: [
      {
        case: {
          $and: [
            { $gt: [{ $size: '$statuses' }, 0] },
            {
              $allElementsTrue: {
                $map: {
                  input: '$statuses',
                  as: 'status',
                  in: { $eq: ['$$status', 'Complete'] },
                },
              },
            },
          ],
        },
        then: 'Complete',
      },
      {
        case: {
          $in: ['Delayed', '$statuses'],
        },
        then: 'Delayed',
      },
      {
        case: {
          $in: ['In Progress', '$statuses'],
        },
        then: 'In Progress',
      },
      {
        case: {
          $in: ['Planning', '$statuses'],
        },
        then: 'Planning',
      },
    ],
    default: 'Unknown',
  },
};

@Injectable()
export class OverallService {
  constructor(
    private db: DbService,
    @InjectModel(Overall.name, 'defaultConnection')
    private overallModel: Model<OverallDocument>,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: PageMetricsModel,
    @InjectModel(Project.name, 'defaultConnection')
    private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name, 'defaultConnection')
    private taskModel: Model<TaskDocument>,
    @InjectModel(UxTest.name, 'defaultConnection')
    private uxTestModel: Model<UxTestDocument>,
    @InjectModel(CallDriver.name, 'defaultConnection')
    private calldriversModel: CallDriverModel,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedbackModel: FeedbackModel,
    @InjectModel(SearchAssessment.name, 'defaultConnection')
    private searchAssessmentModel: Model<SearchAssessmentDocument>,
    @InjectModel(GcTasks.name, 'defaultConnection')
    private gcTasksModel: GcTasksModel,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(Annotations.name, 'defaultConnection')
    private annotationsModel: Model<AnnotationsDocument>,
    private feedbackService: FeedbackService,
  ) {}

  @AsyncLogTiming
  async getMetrics(params: ApiParams): Promise<OverviewData> {
    const cacheKey = `OverviewMetrics-${params.dateRange}-${params['ipd']}`;

    const cachedData = await this.cacheManager.store.get<string>(cacheKey).then(
      async (cachedData) =>
        cachedData &&
        // it's actually still a string here, but we want to avoid deserializing it
        // and then reserializing it to send over http while still keeping our types intact
        ((await decompressString(cachedData)) as unknown as OverviewData),
    );

    if (cachedData) {
      return cachedData;
    }

    const testsSince2018 = await this.uxTestModel.find({
      date: { $gte: new Date('2018-01-01') },
    });

    const calldriverTopics = (
      await this.calldriversModel.getTopicsWithPercentChange(
        params.dateRange,
        params.comparisonDateRange,
      )
    ).sort((a, b) => b.calls - a.calls);

    const top5IncreasedCalldriverTopics = calldriverTopics
      .filter((topic) => topic.change)
      .sort((a, b) => Number(b.change) - Number(a.change))
      .slice(0, 5);

    const top5DecreasedCalldriverTopics = calldriverTopics
      .filter((topic) => Number(topic.change) < 0)
      .sort((a, b) => Number(a.change) - Number(b.change))
      .slice(0, 5);

    const satDateStart = await this.searchAssessmentModel
      .findOne()
      .sort({ date: -1 })
      .exec();

    const satDateRange = `${dayjs
      .utc(satDateStart?.date)
      .startOf('day')
      .format('YYYY-MM-DD')}/${dayjs
      .utc(satDateStart?.date)
      .endOf('week')
      .format('YYYY-MM-DD')}`;
    const satComparisonDateRange = `${dayjs
      .utc(satDateStart?.date)
      .subtract(1, 'weeks')
      .startOf('week')
      .format('YYYY-MM-DD')}/${dayjs
      .utc(satDateStart?.date)
      .subtract(1, 'weeks')
      .endOf('week')
      .format('YYYY-MM-DD')}`;

    const uxTests = (await this.uxTestModel.find({}).lean().exec()) || [];

    const lastQuarter =
      getStructuredDateRangesWithComparison().quarter.dateRange;

    const lastQuarterDateRange = {
      start: lastQuarter.start.toDate(),
      end: lastQuarter.end.toDate(),
    };

    const lastQuarterTopTaskIds =
      await this.db.views.tasks.getTop50TaskIds(lastQuarterDateRange);

    const improvedKpiTopSuccessRate = getImprovedKpiTopSuccessRates(
      lastQuarterTopTaskIds,
      uxTests,
    );

    const totalTasks = await this.taskModel.countDocuments().exec();

    const topTasksTable = (
      await this.db.views.tasks.getAllWithComparisons(
        parseDateRangeString(params.dateRange),
        parseDateRangeString(params.comparisonDateRange),
      )
    )
      .filter((task) => task.top_task)
      .map((taskData) => {
        const { avgTestSuccess, percentChange: avgSuccessPercentChange } =
          getAvgSuccessFromLatestTests(taskData.ux_tests);

        const latest_success_rate_percent_change = percentChange(
          avgTestSuccess,
          avgTestSuccess - avgSuccessPercentChange,
        );

        const latest_success_rate_difference = avgSuccessPercentChange * 100;

        return {
          _id: taskData._id.toString(),
          ...pick(
            [
              'tmf_rank',
              'title',
              'calls_per_100_visits_percent_change',
              'calls_per_100_visits_difference',
              'dyf_no_per_1000_visits_percent_change',
              'dyf_no_per_1000_visits_difference',
              'latest_ux_success',
              'latest_success_rate_difference',
              'latest_success_rate_percent_change',
              'survey_completed',
            ],
            taskData,
          ),
          latest_ux_success: avgTestSuccess,
          latest_success_rate_difference,
          latest_success_rate_percent_change,
        };
      });

    const results = {
      dateRange: params.dateRange,
      comparisonDateRange: params.comparisonDateRange,
      satDateRange,
      satComparisonDateRange,
      dateRangeData: await getOverviewMetrics(
        this.overallModel,
        this.pageMetricsModel,
        this.calldriversModel,
        this.feedbackModel,
        this.pageModel,
        this.annotationsModel,
        this.db,
        this.searchAssessmentModel,
        this.gcTasksModel,
        this.cacheManager,
        params.dateRange,
        satDateRange,
      ),
      comparisonDateRangeData: await getOverviewMetrics(
        this.overallModel,
        this.pageMetricsModel,
        this.calldriversModel,
        this.feedbackModel,
        this.pageModel,
        this.annotationsModel,
        this.db,
        this.searchAssessmentModel,
        this.gcTasksModel,
        this.cacheManager,
        params.comparisonDateRange,
        satComparisonDateRange,
      ),
      projects: await getProjects(this.projectModel, this.uxTestModel),
      uxTests,
      improvedTasksKpi: getImprovedKpiSuccessRates(uxTests),
      improvedKpiTopSuccessRate,
      ...(await getUxData(testsSince2018)),
      calldriverTopics,
      top5IncreasedCalldriverTopics,
      top5DecreasedCalldriverTopics,
      searchTermsEn: await this.getTopSearchTerms(params, 'en'),
      searchTermsFr: await this.getTopSearchTerms(params, 'fr'),
      totalTasks,
      topTasksTable,
    };

    await this.cacheManager.set(
      cacheKey,
      await compressString(JSON.stringify(results)),
    );

    return results;
  }

  @AsyncLogTiming
  async getFeedback(params: ApiParams): Promise<PartialOverviewFeedback> {
    const cacheKey = `OverviewFeedback-${params.dateRange}-${params['ipd']}`;

    const cachedData = await this.cacheManager.store.get<string>(cacheKey).then(
      async (cachedData) =>
        cachedData &&
        // it's actually still a string here, but we want to avoid deserializing it
        // and then reserializing it to send over http while still keeping our types intact
        ((await decompressString(
          cachedData,
        )) as unknown as PartialOverviewFeedback),
    );

    if (cachedData) {
      return cachedData;
    }

    const mostRelevantCommentsAndWords =
      await this.feedbackService.getMostRelevantCommentsAndWords({
        dateRange: parseDateRangeString(params.dateRange),
        ipd: params.ipd as boolean,
      });

    const numComments =
      mostRelevantCommentsAndWords.en.comments.length +
      mostRelevantCommentsAndWords.fr.comments.length;

    const { start: prevDateRangeStart, end: prevDateRangeEnd } =
      parseDateRangeString(params.comparisonDateRange);

    const numPreviousComments = await this.feedbackModel
      .countDocuments({
        date: { $gte: prevDateRangeStart, $lte: prevDateRangeEnd },
      })
      .exec();

    const numCommentsPercentChange =
      !params.ipd && numPreviousComments
        ? percentChange(numComments, numPreviousComments)
        : null;

    const commentsByPage = (
      await this.feedbackService.getNumCommentsByPage(
        params.dateRange,
        params.comparisonDateRange,
      )
    )
      .map(({ _id, title, url, owners, sections, sum, percentChange }) => ({
        _id: _id.toString(),
        title,
        url,
        owners,
        sections,
        sum,
        percentChange,
      }))
      .sort((a, b) => (b.sum || 0) - (a.sum || 0));

    const chunkSize = 80000;

    const enCommentsChunks = {
      cacheKey: `${cacheKey}-en-comments`,
      chunks: chunkMap(
        mostRelevantCommentsAndWords.en.comments,
        (chunk) => chunk,
        chunkSize,
      ),
    };

    const enWordsChunks = {
      cacheKey: `${cacheKey}-en-words`,
      chunks: chunkMap(
        mostRelevantCommentsAndWords.en.words,
        (chunk) => chunk,
        chunkSize,
      ),
    };

    const frCommentsChunks = {
      cacheKey: `${cacheKey}-fr-comments`,
      chunks: chunkMap(
        mostRelevantCommentsAndWords.fr.comments,
        (chunk) => chunk,
        chunkSize,
      ),
    };

    const frWordsChunks = {
      cacheKey: `${cacheKey}-fr-words`,
      chunks: chunkMap(
        mostRelevantCommentsAndWords.fr.words,
        (chunk) => chunk,
        chunkSize,
      ),
    };

    // chunks will likely not be the same length, but to make it easier,
    // we'll still get everything at the same time when fetching and just
    // return an empty array if everything is already fetched for that language/key
    const longestChunks = Math.max(
      enCommentsChunks.chunks.length,
      enWordsChunks.chunks.length,
      frCommentsChunks.chunks.length,
      frWordsChunks.chunks.length,
    );

    const overviewFeedback = {
      mostRelevantCommentsAndWords: {
        parts: longestChunks,
      },
      numComments,
      numCommentsPercentChange,
      commentsByPage,
      feedbackByDay: (
        await this.feedbackModel.getCommentsByDay(params.dateRange)
      ).map(({ date, sum }) => ({
        date: date.toISOString(),
        sum,
      })),
    };

    for (const i of Array.from({ length: longestChunks }).keys()) {
      for (const chunkSet of [
        enCommentsChunks,
        enWordsChunks,
        frCommentsChunks,
        frWordsChunks,
      ]) {
        const chunkKey = `${chunkSet.cacheKey}-${i}`;

        await compressString(JSON.stringify(chunkSet.chunks[i] || [])).then(
          (compressed) => {
            this.cacheManager.set(chunkKey, compressed);
          },
        );

        delete chunkSet.chunks[i];
      }
      logMemoryUsage(`Cached chunked data for part ${i}`);
    }

    await this.cacheManager.set(
      cacheKey,
      await compressString(JSON.stringify(overviewFeedback)),
    );

    // it's actually still a string here, but we want to avoid deserializing it
    // and then reserializing it to send over http while still keeping our types intact
    return overviewFeedback as unknown as PartialOverviewFeedback;
  }

  async getCachedCommentsAndWordsChunk(
    params: ApiParams,
    chunkIndex: number,
  ): Promise<ChunkedMostRelevantCommentsAndWords> {
    const cacheKey = `OverviewFeedback-${params.dateRange}-${params['ipd']}`;

    const enCommentsKey = `${cacheKey}-en-comments-${chunkIndex}`;
    const enWordsKey = `${cacheKey}-en-words-${chunkIndex}`;
    const frCommentsKey = `${cacheKey}-fr-comments-${chunkIndex}`;
    const frWordsKey = `${cacheKey}-fr-words-${chunkIndex}`;

    const enComments = await this.cacheManager.store
      .get<string>(enCommentsKey)
      .then(
        async (cachedData) =>
          cachedData && (await decompressString(cachedData)),
      );

    const enWords = await this.cacheManager.store
      .get<string>(enWordsKey)
      .then(
        async (cachedData) =>
          cachedData && (await decompressString(cachedData)),
      );
    const frComments = await this.cacheManager.store
      .get<string>(frCommentsKey)
      .then(
        async (cachedData) =>
          cachedData && (await decompressString(cachedData)),
      );
    const frWords = await this.cacheManager.store
      .get<string>(frWordsKey)
      .then(
        async (cachedData) =>
          cachedData && (await decompressString(cachedData)),
      );

    // it's actually still a string here, but we want to avoid deserializing it
    // and then reserializing it to send over http while still keeping our types intact
    const chunkedData = `{"enComments": ${enComments || '[]'}, "enWords": ${enWords || '[]'}, "frComments": ${frComments || '[]'}, "frWords": ${frWords || '[]'}}`;

    return chunkedData as unknown as ChunkedMostRelevantCommentsAndWords;
  }

  async getTopSearchTerms(
    { dateRange, comparisonDateRange }: ApiParams,
    lang: 'en' | 'fr',
  ) {
    const [startDate, endDate] = dateRangeSplit(dateRange);
    const [prevStartDate, prevEndDate] = dateRangeSplit(comparisonDateRange);

    const searchTermsPropName = `aa_searchterms_${lang}`;

    const results =
      (await this.overallModel
        .aggregate<OverallSearchTerm>()
        .project({ date: 1, [searchTermsPropName]: 1 })
        .match({
          date: { $gte: startDate, $lte: endDate },
        })
        .unwind(`$${searchTermsPropName}`)
        .addFields({
          [`${searchTermsPropName}.term`]: {
            $toLower: `$${searchTermsPropName}.term`,
          },
        })
        .group({
          _id: `$${searchTermsPropName}.term`,
          total_searches: {
            $sum: `$${searchTermsPropName}.num_searches`,
          },
          clicks: {
            $sum: `$${searchTermsPropName}.clicks`,
          },
          position: {
            $avg: `$${searchTermsPropName}.position`,
          },
        })
        .sort({ total_searches: -1 })
        .limit(50)
        .project({
          _id: 0,
          term: '$_id',
          total_searches: 1,
          clicks: 1,
          ctr: {
            $cond: {
              if: { $eq: ['$total_searches', 0] },
              then: 0,
              else: $trunc({ $divide: ['$clicks', '$total_searches'] }, 3),
            },
          },
          position: $trunc('$position', 3),
        })
        .exec()) || [];

    const prevResults =
      (await this.overallModel
        .aggregate<Pick<OverallSearchTerm, 'term' | 'total_searches'>>()
        .project({ date: 1, [searchTermsPropName]: 1 })
        .match({
          date: { $gte: prevStartDate, $lte: prevEndDate },
        })
        .unwind(`$${searchTermsPropName}`)
        .addFields({
          [`${searchTermsPropName}.term`]: {
            $toLower: `$${searchTermsPropName}.term`,
          },
        })
        .match({
          [`${searchTermsPropName}.term`]: {
            $in: results.map(({ term }) => term),
          },
        })
        .group({
          _id: `$${searchTermsPropName}.term`,
          total_searches: {
            $sum: `$${searchTermsPropName}.num_searches`,
          },
        })
        .project({
          _id: 0,
          term: '$_id',
          total_searches: 1,
        })
        .exec()) || [];

    const prevResultsDict = arrayToDictionary(prevResults, 'term');

    return results.map((result) => {
      const prevSearches = prevResultsDict[result.term]?.total_searches;
      const searchesChange =
        typeof prevSearches === 'number' && prevSearches !== 0
          ? Math.round(
              ((result.total_searches - prevSearches) / prevSearches) * 100,
            ) / 100
          : null;

      return {
        ...result,
        prevSearches,
        searchesChange,
      };
    });
  }
}

async function getProjects(
  projectModel: Model<ProjectDocument>,
  uxTestsModel: Model<UxTestDocument>,
): Promise<OverviewProjectData> {
  const defaultData = {
    numInProgress: 0,
    numCompletedLast6Months: 0,
    totalCompleted: 0,
    numDelayed: 0,
  };

  const sixMonthsAgo = dayjs().utc(false).subtract(6, 'months').toDate();
  const year2018 = dayjs('2018-01-01').utc(false).toDate();

  const uxTest =
    (
      await uxTestsModel
        .aggregate()
        .group({
          _id: '$cops',
          count: { $sum: 1 },
          countLast6Months: {
            $sum: {
              $cond: [{ $gte: ['$date', sixMonthsAgo] }, 1, 0],
            },
          },
          countSince2018: {
            $sum: {
              $cond: [{ $gte: ['$date', year2018] }, 1, 0],
            },
          },
        })
        .group({
          _id: null,
          numInProgress: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'In Progress'] }, '$count', 0],
            },
          },
          completedLast6Months: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Complete'] }, '$countLast6Months', 0],
            },
          },
          completedSince2018: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Complete'] }, '$countSince2018', 0],
            },
          },
          copsCompletedSince2018: {
            $sum: {
              $cond: [{ $eq: ['$_id', true] }, '$countSince2018', 0],
            },
          },
          totalCompleted: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Complete'] }, '$count', 0],
            },
          },
          numDelayed: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Delayed'] }, '$count', 0],
            },
          },
        })
        .project({
          _id: 0,
          copsCompletedSince2018: 1,
        })
        .exec()
    )[0] || defaultData;

  const aggregatedData =
    (
      await uxTestsModel
        .aggregate<Omit<ProjectsHomeData, 'projects'>>()
        .group({
          _id: '$project',
          statuses: {
            $addToSet: '$status',
          },
          date: { $min: '$date' },
        })
        .project({
          last6Months: {
            $gte: ['$date', sixMonthsAgo],
          },
          since2018: {
            $gte: ['$date', year2018],
          },
          status: projectStatusSwitchExpression,
        })
        .sort({ status: 1 })
        .group({
          _id: '$status',
          count: { $sum: 1 },
          countLast6Months: {
            $sum: {
              $cond: [{ $gte: ['$date', sixMonthsAgo] }, 1, 0],
            },
          },
          countSince2018: {
            $sum: {
              $cond: [{ $gte: ['$date', year2018] }, 1, 0],
            },
          },
        })
        .group({
          _id: null,
          numInProgress: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'In Progress'] }, '$count', 0],
            },
          },
          completedLast6Months: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Complete'] }, '$countLast6Months', 0],
            },
          },
          completedSince2018: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Complete'] }, '$countSince2018', 0],
            },
          },
          totalCompleted: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Complete'] }, '$count', 0],
            },
          },
          numDelayed: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'Delayed'] }, '$count', 0],
            },
          },
        })
        .project({
          _id: 0,
          numInProgress: 1,
          completedSince2018: 1,
          numCompletedLast6Months: 1,
          totalCompleted: 1,
          numDelayed: 1,
        })
        .exec()
    )[0] || defaultData;

  const projectsData = await uxTestsModel
    .aggregate<OverviewProject>()
    .group({
      _id: '$project',
      cops: { $max: '$cops' },
      startDate: { $min: '$date' },
      launchDate: { $max: '$launch_date' },
      avgSuccessRate: { $avg: '$success_rate' },
      uxTests: {
        $push: {
          success_rate: '$success_rate',
          date: '$date',
          test_type: '$test_type',
          task: '$tasks',
          title: '$title',
        },
      },
      statuses: { $addToSet: '$status' },
      totalUsers: { $sum: '$total_users' },
      testType: { $addToSet: '$test_type' },
    })
    .addFields({
      status: projectStatusSwitchExpression,
    })
    .project({
      title: {
        $arrayElemAt: ['$uxTests.title', 0],
      },
      cops: 1,
      startDate: 1,
      launchDate: 1,
      avgSuccessRate: 1,
      status: 1,
      totalUsers: 1,
      testType: 1,
      uxTests: 1,
    })
    .sort({
      _id: 1,
    })
    .exec();

  const avgUxTest: {
    percentChange: number;
    avgTestSuccess: number;
    total: number;
  }[] = [];

  for (const data of projectsData) {
    const { percentChange, avgTestSuccess, total } = getLatestTestData(
      data.uxTests,
    );

    data.lastAvgSuccessRate = avgTestSuccess;

    if (avgTestSuccess !== null) {
      avgUxTest.push({ percentChange, avgTestSuccess, total });
    }
  }

  const kpiUxTestsSuccessRates = projectsData
    .flatMap((project) => project.uxTests)
    .filter(
      (test) =>
        test.test_type === 'Validation' &&
        (test.success_rate || test.success_rate === 0),
    )
    .map((test) => test.success_rate);

  const avgTestSuccessAvg = avg(kpiUxTestsSuccessRates, 2);

  const kpiUxTestsSuccessRates2 = projectsData
    .flatMap((project) => {
      const testsByType: { [key: string]: any[] } = {}; // Object to store tests by type

      // Iterate through tests of each project and categorize them by type
      project.uxTests.forEach((test) => {
        if (testsByType[test.test_type]) {
          testsByType[test.test_type].push(test);
        } else {
          testsByType[test.test_type] = [test];
        }
      });

      // Filter and return tests based on the criteria
      const filteredTests = [];

      // Include tests from projects tested once by type (Baseline, Spot Check, or Exploratory)
      ['Baseline', 'Spot Check', 'Exploratory'].forEach((type) => {
        if (testsByType[type] && testsByType[type].length === 1) {
          const test = testsByType[type][0];
          const projectAlreadyCounted = filteredTests.some(
            (t) => t.test_type === type,
          );
          if (!projectAlreadyCounted) {
            filteredTests.push(test);
          }
        }
      });

      // Include all validation tests
      Object.values(testsByType).forEach((tests: any[]) => {
        if (tests.length >= 2 && tests[0].test_type === 'Validation') {
          tests.forEach((test) => {
            const projectAlreadyCounted = filteredTests.some(
              (t) => t.test_type === 'Validation',
            );
            if (!projectAlreadyCounted) {
              filteredTests.push(test);
            }
          });
        }
      });

      return filteredTests;
    })
    .filter((test) => test.success_rate || test.success_rate === 0)
    .map((test) => test.success_rate);

  const avgTestSuccess = avg(kpiUxTestsSuccessRates2, 2);

  const taskSuccessRatesRecord: Record<string, number[]> = projectsData
    .flatMap((project) => project.uxTests)
    .filter(
      (test) =>
        test.test_type === 'Validation' &&
        (test.success_rate || test.success_rate === 0) &&
        test.task &&
        test.title,
    )
    .reduce(
      (acc, test) => {
        if (!acc[test.task]) {
          acc[test.task] = [];
        }

        acc[test.task].push(test.success_rate);

        return acc;
      },
      {} as Record<string, number[]>,
    );

  // except this is actually "unique tasks tested?"
  const testsCompleted = Object.values(taskSuccessRatesRecord).length;

  const uniqueTasksTested: Set<string> = new Set();

  projectsData.forEach((project) => {
    const testsByType: { [key: string]: any[] } = {};

    project.uxTests.forEach((test) => {
      if (testsByType[test.test_type]) {
        testsByType[test.test_type].push(test);
      } else {
        testsByType[test.test_type] = [test];
      }
    });

    // Include tests from projects tested once by type (Baseline, Spot Check, or Exploratory)
    ['Baseline', 'Spot Check', 'Exploratory'].forEach((type) => {
      if (testsByType[type] && testsByType[type].length === 1) {
        uniqueTasksTested.add(testsByType[type][0].task);
      }
    });

    // Include all validation tests
    Object.values(testsByType).forEach((tests: any[]) => {
      if (tests.length >= 2 && tests[0].test_type === 'Validation') {
        tests.forEach((test) => {
          uniqueTasksTested.add(test.task);
        });
      }
    });
  });

  const uniqueTaskTestedLatestTestKpi = uniqueTasksTested.size;

  return {
    ...aggregatedData,
    ...uxTest,
    projects: projectsData,
    avgUxTest,
    avgTestSuccessAvg,
    testsCompleted,
    uniqueTaskTestedLatestTestKpi,
    avgTestSuccess,
  };
}

async function getOverviewMetrics(
  overallModel: Model<OverallDocument>,
  PageMetricsModel: PageMetricsModel,
  calldriversModel: CallDriverModel,
  feedbackModel: FeedbackModel,
  pageModel: Model<PageDocument>,
  annotationsModel: Model<AnnotationsDocument>,
  db: DbService,
  searchAssessmentModel: Model<SearchAssessmentDocument>,
  gcTasksModel: GcTasksModel,
  cacheManager: Cache,
  dateRange: string,
  satDateRange: string,
): Promise<OverviewAggregatedData> {
  const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

  const dateQuery: FilterQuery<Date> = {
    $gte: startDate,
    $lte: endDate,
  };

  const [satStartDate, satEndDate] = satDateRange
    .split('/')
    .map((d) => new Date(d));

  const satDateQuery: FilterQuery<Date> = {
    $gte: satStartDate,
    $lte: satEndDate,
  };

  // Perform queries in parallel
  const [
    annotations,
    visitsByDay,
    dyfByDay,
    calldriversByDay,
    calldriversEnquiry,
    topPagesVisited,
    top10GSC,
    aggregatedMetrics,
    searchAssessmentData,
    gcTasksComments,
    gcTasksData,
  ] = await Promise.all([
    // annotations
    annotationsModel
      .find({ event_date: dateQuery })
      .lean()
      .exec()
      .then((annotations) =>
        annotations.map((item) => ({
          ...item,
          event_date: item.event_date.toISOString(),
        })),
      ),
    // visitsByDay
    overallModel
      .find({ date: dateQuery }, { date: 1, visits: 1 })
      .sort({ date: 1 })
      .lean()
      .exec()
      .then((visits) =>
        visits.map((visit) =>
          omit(['_id'], {
            ...visit,
            date: visit.date.toISOString(),
          }),
        ),
      ),
    // dyfByDay
    overallModel
      .find(
        { date: dateQuery },
        { date: 1, dyf_yes: 1, dyf_no: 1, dyf_submit: 1 },
      )
      .sort({ date: 1 })
      .lean()
      .exec()
      .then((dyf) =>
        dyf.map((item) =>
          omit(['_id'], {
            ...item,
            date: item.date.toISOString(),
          }),
        ),
      ),
    // calldriversByDay
    calldriversModel
      .aggregate()
      .match({ date: dateQuery })
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
      .exec(),
    // calldriversEnquiry
    calldriversModel
      .aggregate()
      .project({
        date: 1,
        enquiry_line: 1,
        calls: 1,
      })
      .match({ date: dateQuery })
      .group({
        _id: '$enquiry_line',
        sum: { $sum: '$calls' },
      })
      .sort({ sum: -1 })
      .project({
        _id: 0,
        enquiry_line: '$_id',
        sum: 1,
      })
      .exec(),
    // topPagesVisited
    db.views.pages.getTopVisitedPages({ start: startDate, end: endDate }, 10),
    // top10GSC
    overallModel
      .aggregate()
      .project({
        date: 1,
        gsc_searchterms: { $slice: ['$gsc_searchterms', 300] },
      })
      .match({ date: dateQuery })
      .unwind('$gsc_searchterms')
      .group({
        _id: '$gsc_searchterms.term',
        clicks: { $sum: '$gsc_searchterms.clicks' },
        impressions: { $sum: '$gsc_searchterms.impressions' },
        ctr: { $avg: '$gsc_searchterms.ctr' },
        position: { $avg: '$gsc_searchterms.position' },
      })
      .sort({ clicks: -1 })
      .limit(10)
      .exec(),
    // aggregatedMetrics
    overallModel
      .aggregate()
      .match({ date: dateQuery })
      .group({
        _id: null,
        visitors: { $sum: '$visitors' },
        visits: { $sum: '$visits' },
        pageViews: { $sum: '$views' },
        impressions: { $sum: '$gsc_total_impressions' },
        ctr: { $avg: '$gsc_total_ctr' },
        position: { $avg: '$gsc_total_position' },
        dyf_yes: { $sum: '$dyf_yes' },
        dyf_no: { $sum: '$dyf_no' },
        dyf_submit: { $sum: '$dyf_submit' },
      })
      .project({ _id: 0 })
      .exec(),
    // searchAssessmentData
    searchAssessmentModel
      .aggregate()
      .match({ date: satDateQuery })
      // don't group by query if there is a value in en or fr
      .group({
        _id: {
          query: '$query',
          lang: '$lang',
        },
        total_clicks: { $sum: '$total_clicks' },
        target_clicks: { $sum: '$target_clicks' },
        total_searches: { $sum: '$total_searches' },
        expected_position: { $avg: '$expected_position' },
        position: { $avg: '$expected_position' },
        expected_result: { $first: '$expected_result' },
      })
      .project({
        query: '$_id.query',
        lang: '$_id.lang',
        _id: 0,
        total_clicks: 1,
        target_clicks: 1,
        total_searches: 1,
        position: 1,
        expected_result: 1,
      })
      .exec(),
    // gcTasksComments
    gcTasksModel.aggregate().match({
      date: dateQuery,
      sampling_task: 'y',
      able_to_complete: {
        $in: ['Yes', 'No'],
      },
    }),
    // gcTasksData
    gcTasksModel.getGcTaskData(dateRange),
  ]);

  return {
    visitsByDay,
    calldriversByDay,
    dyfByDay,
    calldriversEnquiry,
    searchAssessmentData,
    ...aggregatedMetrics[0],
    topPagesVisited,
    top10GSC,
    annotations,
    gcTasksData,
    gcTasksComments,
  };
}

interface ProjectData {
  testTypes: Set<string>;
  tasks: Set<string>;
  cops: Set<string>;
  lastQuarterTests: Set<string>;
  lastFiscalTests: Set<string>;
}

async function getUxData(uxTests: UxTest[]): Promise<OverviewUxData> {
  const projectData: { [key: string]: ProjectData } = {};
  const datejs = dayjs.utc();
  const lastQuarterStart = datejs.subtract(1, 'quarter').startOf('quarter');
  const lastQuarterEnd = lastQuarterStart.endOf('quarter');
  const currentYearEnd = datejs.month(2).endOf('month').startOf('day');
  const lastFiscalEnd = currentYearEnd.isAfter(datejs)
    ? currentYearEnd.subtract(1, 'year')
    : currentYearEnd;
  const lastFiscalStart = lastFiscalEnd.subtract(1, 'year').add(1, 'day');

  uxTests
    .filter((test) => test.status === 'Complete')
    .map((test) => {
      const project = test.project ? test.project.toString() : 'unknown';
      projectData[project] = projectData[project] || {
        testTypes: new Set(),
        tasks: new Set(),
        cops: new Set(),
        lastQuarterTests: new Set(),
        lastFiscalTests: new Set(),
      };

      projectData[project].testTypes.add(test.test_type);

      if (test.tasks) projectData[project].tasks.add(test.tasks.toString());
      if (test.cops) projectData[project].cops.add(test.test_type.toString());
      if (
        test.date >= lastQuarterStart.toDate() &&
        test.date <= lastQuarterEnd.toDate()
      )
        projectData[project].lastQuarterTests.add(test.test_type);
      if (
        test.date >= lastFiscalStart.toDate() &&
        test.date <= lastFiscalEnd.toDate()
      )
        projectData[project].lastFiscalTests.add(test.test_type);
    });

  let testsCompletedSince2018 = 0,
    tasksTestedSince2018 = 0,
    copsTestsCompletedSince2018 = 0,
    testsConductedLastQuarter = 0,
    testsConductedLastFiscal = 0;

  for (const project in projectData) {
    const { testTypes, tasks, cops, lastQuarterTests, lastFiscalTests } =
      projectData[project];
    testsCompletedSince2018 += testTypes.size;
    tasksTestedSince2018 += tasks.size;
    copsTestsCompletedSince2018 += cops.size;
    testsConductedLastQuarter += lastQuarterTests.size;
    testsConductedLastFiscal += lastFiscalTests.size;
  }

  tasksTestedSince2018 = Object.values(projectData).reduce((acc, { tasks }) => {
    tasks.forEach((task) => acc.add(task));
    return acc;
  }, new Set<string>()).size;

  const uniqueGroupMap = uxTests.reduce((map, test) => {
    const key = `${test.title}||${test.test_type}`;
    return map.set(key, { title: test.title, test_type: test.test_type });
  }, new Map());

  const uniqueGroups = Array.from(uniqueGroupMap.values());
  const uxTestsMaxUsers = uniqueGroups.map(({ title, test_type }) => {
    const filteredTests = uxTests
      .filter((test) => test.title === title && test.test_type === test_type)
      .map((test) => test.total_users)
      .filter((val) => typeof val === 'number' && !isNaN(val));

    return {
      title,
      test_type,
      total_users: filteredTests.length > 0 ? Math.max(...filteredTests) : 0,
    };
  });

  const participantsTestedSince2018 = uxTestsMaxUsers.reduce(
    (total, test) => total + test.total_users,
    0,
  );

  return {
    testsCompletedSince2018,
    tasksTestedSince2018,
    participantsTestedSince2018,
    testsConductedLastFiscal,
    testsConductedLastQuarter,
    copsTestsCompletedSince2018,
  };
}

const logMemoryUsage = (contextString: string) => {
  const mbUsed = process.memoryUsage().heapUsed / 1024 / 1024;

  console.log(
    `[${contextString}] Memory used: ${Math.round(mbUsed * 100) / 100} MB`,
  );
};
