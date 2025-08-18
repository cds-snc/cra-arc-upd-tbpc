import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type {
  AnyBulkWriteOperation,
  Connection,
  FilterQuery,
  Model,
  mongo,
} from 'mongoose';
import { uniq } from 'rambdax';
import {
  CallDriver,
  Feedback,
  Overall,
  PageMetrics,
  Page,
  PagesList,
  Task,
  UxTest,
  Project,
  AAItemId,
  SearchAssessment,
  Readability,
  PageMetricsTS,
  Url,
  Annotations,
  Reports,
  type PageMetricsModel,
  type ReadabilityModel,
  type UrlModel,
  CustomReportsRegistry,
  CustomReportsMetrics,
  type CustomReportsModel,
  type CallDriverModel,
  GcTasks,
  GCTasksMappings,
  type GcTasksModel,
  type FeedbackModel,
  type PageModel,
} from '../';
import {
  arrayToDictionary,
  AsyncLogTiming,
  hours,
  logJson,
  mapWithETALoggingAsync,
  prettyJson,
} from '@dua-upd/utils-common';
import { PageVisits, PageVisitsView } from './db.views';
import {
  PagesView,
  type PagesViewModel,
  PagesViewSchema,
} from './views/pages-view.schema';
import { PagesViewService } from './views/pages.view';
import { TasksViewService } from './views/tasks.view';
import {
  TasksView,
  type TasksViewModel,
  TasksViewSchema,
} from './views/tasks-view.schema';

/**
 * This service is primarily for accessing all collection models from the same place
 * via DbService.collections
 *
 * MongoDB references:
 *
 * [CRUD Operations docs]{@link https://www.mongodb.com/docs/v4.4/crud/}
 *
 * [Aggregation pipeline explainer]{@link https://www.mongodb.com/docs/v4.4/core/aggregation-pipeline/}
 *
 * [Aggregation pipeline reference]{@link https://www.mongodb.com/docs/v4.4/reference/aggregation/}
 */
@Injectable()
export class DbService {
  readonly collections = {
    callDrivers: this.callDrivers,
    feedback: this.feedback,
    overall: this.overall,
    pageMetrics: this.pageMetrics,
    pageMetricsTS: this.pageMetricsTS,
    pages: this.pages,
    pagesList: this.pagesList,
    tasks: this.tasks,
    uxTests: this.uxTests,
    projects: this.projects,
    aaItemIds: this.aaItemIds,
    searchAssessment: this.searchAssessment,
    urls: this.urls,
    readability: this.readability,
    annotations: this.annotations,
    reports: this.reports,
    customReportsRegistry: this.customReportsRegistry,
    customReportsMetrics: this.customReportsMetrics,
    gcTasks: this.gcTasks,
    gcTasksMappings: this.gcTasksMappings,
  } as const;

  readonly views = {
    pages: new PagesViewService(this, {
      name: 'PagesView',
      model: this.pagesViewModel,
      schema: PagesViewSchema,
      maxAge: hours(Number(process.env.DB_VIEWS_MAXAGE) || 120),
      refreshBatchSize: 50,
      bulkWriteOptions: { noResponse: true },
    }),
    tasks: new TasksViewService(this, {
      name: 'TasksView',
      model: this.tasksViewModel,
      schema: TasksViewSchema,
      maxAge: hours(Number(process.env.DB_VIEWS_MAXAGE) || 120),
      refreshBatchSize: 10,
      bulkWriteOptions: { noResponse: true },
    }),
  } as const;

  constructor(
    @InjectModel(CallDriver.name, 'defaultConnection')
    private callDrivers: CallDriverModel,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedback: FeedbackModel,
    @InjectModel(Overall.name, 'defaultConnection')
    private overall: Model<Overall>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetrics: PageMetricsModel,
    @InjectModel(PageMetricsTS.name, 'defaultConnection')
    private pageMetricsTS: Model<PageMetricsTS>,
    @InjectModel(Page.name, 'defaultConnection')
    private pages: PageModel,
    @InjectModel(PagesList.name, 'defaultConnection')
    private pagesList: Model<PagesList>,
    @InjectModel(Task.name, 'defaultConnection')
    private tasks: Model<Task>,
    @InjectModel(UxTest.name, 'defaultConnection')
    private uxTests: Model<UxTest>,
    @InjectModel(Project.name, 'defaultConnection')
    private projects: Model<Project>,
    @InjectModel(AAItemId.name, 'defaultConnection')
    private aaItemIds: Model<AAItemId>,
    @InjectModel(SearchAssessment.name, 'defaultConnection')
    private searchAssessment: Model<SearchAssessment>,
    @InjectModel(Readability.name, 'defaultConnection')
    private readability: ReadabilityModel,
    @InjectModel(Annotations.name, 'defaultConnection')
    private annotations: Model<Annotations>,
    @InjectModel(PagesView.name, 'defaultConnection')
    private pagesViewModel: PagesViewModel,
    @InjectModel(TasksView.name, 'defaultConnection')
    private tasksViewModel: TasksViewModel,
    @InjectModel(Url.name, 'defaultConnection')
    private urls: UrlModel,
    @InjectModel(Reports.name, 'defaultConnection')
    private reports: Model<Reports>,
    @InjectModel(CustomReportsRegistry.name, 'defaultConnection')
    private customReportsRegistry: Model<CustomReportsRegistry>,
    @InjectModel(CustomReportsMetrics.name, 'defaultConnection')
    private customReportsMetrics: CustomReportsModel,
    @InjectModel(GcTasks.name, 'defaultConnection')
    private gcTasks: GcTasksModel,
    @InjectModel(GCTasksMappings.name, 'defaultConnection')
    private gcTasksMappings: Model<GCTasksMappings>,
    @InjectConnection('defaultConnection')
    private connection: Connection,
  ) {}

  async ensureIndexes() {
    for (const collection in this.collections) {
      console.log(`Ensuring indexes for collection: ${collection}`);
      await this.collections[collection].ensureIndexes();
    }

    for (const view in this.views) {
      console.log(`Ensuring indexes for view: ${view}`);
      await this.views[view].model.ensureIndexes();
    }
  }

  async batchWrite<ModelT extends Model<any>>(
    model: ModelT,
    operations: AnyBulkWriteOperation[],
    options?: { batchSize: number } & mongo.BulkWriteOptions,
  ): Promise<number> {
    // assume all operations are the same
    if (operations.length === 0) {
      return 0;
    }

    let totalModifiedCount = 0;

    const batchSize = options?.batchSize || 1;

    while (operations.length !== 0) {
      const batch = operations.splice(0, batchSize);

      const result = await model.bulkWrite(batch, options);
      totalModifiedCount += result.modifiedCount || 0;
    }

    return totalModifiedCount;
  }

  @AsyncLogTiming
  async validatePageMetricsRefs(filter: FilterQuery<PageMetrics> = {}) {
    return await this.simplifiedValidatePageRefs(filter);
  }

  /**
   * Wraps a function in a transaction
   * The session *must* be passed to each operation that should be part of the transaction
   * @param fn - The function to wrap in a transaction
   */
  async transaction(fn: (session: mongo.ClientSession) => Promise<void>) {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(fn, { retryWrites: true });
    } catch (err) {
      console.error('Transaction aborted. Caught error during transaction.');

      throw err;
    } finally {
      await session.endSession();
    }
  }

  private async validateAllPageMetricsRefs() {
    const pageMetricsUrls = await this.pageMetrics.distinct('url');

    if (!pageMetricsUrls?.length) {
      return;
    }

    const bulkWriteOps: AnyBulkWriteOperation[] = [];

    const pages: Page[] = await this.pages
      .find({}, { url: 1, projects: 1, ux_tests: 1, tasks: 1 })
      .lean()
      .exec();

    if (pages) {
      const pagesDict: Record<string, Page> = arrayToDictionary(pages, 'url');

      for (const metricsUrl of pageMetricsUrls) {
        const matchingPage = pagesDict[metricsUrl];

        if (matchingPage) {
          bulkWriteOps.push({
            updateMany: {
              filter: { url: metricsUrl },
              update: {
                $set: {
                  page: matchingPage._id,
                  projects: matchingPage.projects,
                  tasks: matchingPage.tasks,
                  ux_tests: matchingPage.ux_tests,
                },
              },
            },
          });
        }
      }

      if (bulkWriteOps.length) {
        const writeResults = await this.pageMetrics.bulkWrite(bulkWriteOps, {
          ordered: false,
        });
        console.log('validateAllPageRefs writeResults:');
        logJson(writeResults);
      }
    }
  }

  private async simplifiedValidatePageRefs(filter: FilterQuery<PageMetrics>) {
    console.log('Validating page metrics references...');
    const pages: Page[] = await this.pages
      .find({}, { url: 1, tasks: 1, projects: 1, ux_tests: 1 })
      .lean()
      .exec();

    if (!pages) {
      throw new Error('No pages found?');
    }

    const dateFilter = filter.date ? { date: filter.date } : {};

    await mapWithETALoggingAsync(
      pages,
      async (page) =>
        await this.pageMetrics
          .updateMany(
            { ...dateFilter, url: page.url },
            {
              $set: {
                page: page._id,
                projects: page.projects,
                tasks: page.tasks,
                ux_tests: page.ux_tests,
              },
            },
          )
          .exec(),
      25,
    );

    console.log('validatePageRefs complete');
  }

  private async validateFilteredPageMetricsRefs(
    filter: FilterQuery<PageMetrics>,
  ) {
    const pageMetrics: PageMetrics[] = await this.pageMetrics
      .find(filter, { page: 1, url: 1 })
      .lean()
      .exec();

    if (!pageMetrics) {
      return;
    }

    const bulkWriteOps: AnyBulkWriteOperation[] = [];

    // first check metrics without refs to see if we can add any
    const metricsWithNoRefs = pageMetrics.filter((metrics) => !metrics.page);

    if (metricsWithNoRefs.length) {
      const uniqueUrls = uniq(metricsWithNoRefs.map((metrics) => metrics.url));

      const pages: Page[] = await this.pages
        .find(
          { url: { $in: uniqueUrls } },
          { url: 1, projects: 1, ux_tests: 1, tasks: 1 },
        )
        .lean()
        .exec();

      if (pages) {
        const pagesDict = arrayToDictionary(pages, 'url');

        for (const url of uniqueUrls) {
          const matchingPage = pagesDict[url];

          if (matchingPage) {
            bulkWriteOps.push({
              updateMany: {
                filter: { ...filter, url },
                update: {
                  $set: {
                    page: matchingPage._id,
                    projects: matchingPage.projects,
                    tasks: matchingPage.tasks,
                    ux_tests: matchingPage.ux_tests,
                  },
                },
              },
            });
          }
        }
      }
    }

    // then check metrics with refs to see if any are invalid, and update them where possible
    const metricsWithRefs = pageMetrics.filter((metrics) => metrics.page);

    if (metricsWithRefs.length) {
      const uniqueUrls = uniq(metricsWithRefs.map((metrics) => metrics.url));

      const pages: Page[] = await this.pages
        .find(
          { url: { $in: uniqueUrls } },
          { url: 1, projects: 1, ux_tests: 1, tasks: 1 },
        )
        .lean()
        .exec();

      if (pages) {
        const pagesDict = arrayToDictionary(pages, 'url');

        for (const url of uniqueUrls) {
          const matchingPage = pagesDict[url];

          if (matchingPage) {
            bulkWriteOps.push({
              updateMany: {
                filter: { ...filter, url },
                update: {
                  $set: {
                    page: matchingPage._id,
                    projects: matchingPage.projects,
                    tasks: matchingPage.tasks,
                    ux_tests: matchingPage.ux_tests,
                  },
                },
              },
            });
          }
        }
      }
    }

    if (bulkWriteOps.length) {
      console.log(`${bulkWriteOps.length} bulkWriteOps`);

      const writeResults = await this.pageMetrics.bulkWrite(bulkWriteOps, {
        ordered: false,
      });

      console.log('validatePageRefs writeResults:');
      logJson(writeResults);
    }
  }

  @AsyncLogTiming
  async addMissingAirtableRefsToPageMetrics() {
    console.log('Checking for missing refs in pages_metrics');

    const projects =
      (await this.projects.find({}, { title: 1, pages: 1 }).lean().exec()) ||
      [];
    const tasks =
      (await this.tasks.find({}, { title: 1, pages: 1 }).lean().exec()) || [];
    const uxTests =
      (await this.uxTests.find({}, { title: 1, pages: 1 }).lean().exec()) || [];

    for (const project of projects) {
      let metricsMissingRefs = await this.pageMetrics
        .find(
          {
            page: { $in: project.pages },
            projects: { $not: { $elemMatch: { $eq: project._id } } },
          },
          { _id: 0, page: 1, projects: 1 },
        )
        .lean()
        .exec();

      if (metricsMissingRefs.length) {
        console.log(
          `Found ${metricsMissingRefs.length} page metrics missing refs for Project: ${project.title}`,
        );

        const results = await this.pageMetrics.updateMany(
          {
            page: { $in: project.pages },
            projects: { $not: { $elemMatch: { $eq: project._id } } },
          },
          { $addToSet: { projects: project._id } },
        );

        console.log('updateResult: ', prettyJson(results));
      }

      // free memory
      metricsMissingRefs = null;
    }

    for (const task of tasks) {
      let metricsMissingRefs = await this.pageMetrics
        .find({
          page: { $in: task.pages },
          tasks: { $not: { $elemMatch: { $eq: task._id } } },
        })
        .lean()
        .exec();

      if (metricsMissingRefs.length) {
        console.log(
          `Found ${metricsMissingRefs.length} page metrics missing refs for Task: ${task.title}`,
        );

        const results = await this.pageMetrics.updateMany(
          {
            page: { $in: task.pages },
            tasks: { $not: { $elemMatch: { $eq: task._id } } },
          },
          { $addToSet: { tasks: task._id } },
        );

        console.log('updateResult: ', prettyJson(results));
      }

      // free memory
      metricsMissingRefs = null;
    }

    for (const uxTest of uxTests) {
      let metricsMissingRefs = await this.pageMetrics
        .find({
          page: { $in: uxTest.pages },
          ux_tests: { $not: { $elemMatch: { $eq: uxTest._id } } },
        })
        .lean()
        .exec();

      if (metricsMissingRefs.length) {
        console.log(
          `Found ${metricsMissingRefs.length} page metrics missing refs for UX Test: ${uxTest.title}`,
        );

        const results = await this.pageMetrics.updateMany(
          {
            page: { $in: uxTest.pages },
            ux_tests: { $not: { $elemMatch: { $eq: uxTest._id } } },
          },
          { $addToSet: { ux_tests: uxTest._id } },
        );

        console.log('updateResult: ', prettyJson(results));
      }

      // free memory
      metricsMissingRefs = null;
    }

    console.log('Finished adding missing refs to pages_metrics.');
  }
}
