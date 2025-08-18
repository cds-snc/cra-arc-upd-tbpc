import type {
  AbstractDate,
  DateRange,
  IOverall,
  IPage,
} from '@dua-upd/types-common';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types, type AnyBulkWriteOperation } from 'mongoose';
import { DbService, Overall, Page, PageMetrics, PagesList } from '@dua-upd/db';
import type {
  OverallDocument,
  PageDocument,
  PageMetricsModel,
  PagesListDocument,
} from '@dua-upd/db';
import {
  SearchAnalyticsClient,
  SearchAssessmentService,
} from '@dua-upd/external-data';
import { BlobLogger } from '@dua-upd/logger';
import {
  AsyncLogTiming,
  Retry,
  getDateRangesWithComparison,
  wait,
} from '@dua-upd/utils-common';
import { CalldriversService } from './airtable/calldrivers.service';
import { FeedbackService } from './feedback/feedback.service';
import { GcTaskService } from './gc-task/gc-task.service';
import { AirtableService } from './airtable/airtable.service';
import { OverallMetricsService } from './overall-metrics/overall-metrics.service';
import { PageUpdateService } from './pages/pages.service';
import { PageMetricsService } from './pages-metrics/page-metrics.service';
import { InternalSearchTermsService } from './internal-search/search-terms.service';
import { ActivityMapService } from './activity-map/activity-map.service';
import { UrlsService } from './urls/urls.service';
import dayjs from 'dayjs';
import { AnnotationsService } from './airtable/annotations.service';
import { GCTasksMappingsService } from './airtable/gc-tasks-mappings.service';

@Injectable()
export class DbUpdateService {
  constructor(
    private db: DbService,
    @Inject('DB_UPDATE_LOGGER')
    private logger: BlobLogger,
    @Inject('ENV') private production: boolean,
    @Inject(SearchAnalyticsClient.name)
    private gscClient: SearchAnalyticsClient,
    private airtableService: AirtableService,
    private calldriversService: CalldriversService,
    private feedbackService: FeedbackService,
    private annotationsService: AnnotationsService,
    private gcTaskService: GcTaskService,
    private gcTasksMappingsService: GCTasksMappingsService,
    private overallMetricsService: OverallMetricsService,
    private pagesService: PageUpdateService,
    private pageMetricsService: PageMetricsService,
    private internalSearchService: InternalSearchTermsService,
    private activityMapService: ActivityMapService,
    private searchAssessmentService: SearchAssessmentService,
    @InjectModel(Overall.name, 'defaultConnection')
    private overallMetricsModel: Model<OverallDocument>,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: PageMetricsModel,
    @InjectModel(PagesList.name, 'defaultConnection')
    private pagesListModel: Model<PagesListDocument>,
    private urlsService: UrlsService,
  ) {
    this.logger.setContext('DbUpdater');

    if (!this.production) {
      this.logger.disableBlobLogging();
    }
  }

  private setBlobLogTargets() {
    const date = dayjs().format('YYYY-MM-DD');
    const month = dayjs().format('YYYY-MM');

    this.logger.setLogLevelTargets({
      error: `${month}/db-update_errors_${date}`,
      warn: `${month}/db-update_${date}`,
      log: `${month}/db-update_${date}`,
    });
  }

  @Retry(4, 1000)
  async updateSAT() {
    this.logger.log('Starting search assessment...');
    await this.searchAssessmentService.upsertPreviousSearchAssessment();
    await this.searchAssessmentService.getLatestSearchAssessment();
    this.logger.log('Search assessment successfully updated.');
  }

  @Retry(4, 1000)
  async updateActivityMap() {
    this.logger.log('Starting activity map...');
    await this.activityMapService.updateActivityMap();
    this.logger.log('Activity map successfully updated.');
  }

  async updateAll(
    logToBlobs = false,
    options?: { skipAirtableUpdates: boolean },
  ) {
    if (logToBlobs) {
      this.setBlobLogTargets();
    }

    this.logger.log('Starting database updates...');

    try {
      // Make sure not to run updates for the same data sources at
      //  the same time, or else we'll hit the rate limit

      await this.airtableService.updatePagesList();
      this.logger.log('Published Pages list successfully updated');

      await Promise.allSettled([
        this.overallMetricsService
          .updateOverallMetrics()
          .catch((err) =>
            this.logger.error(`Error updating overall metrics\n${err.stack}`),
          ),
        options?.skipAirtableUpdates
          ? Promise.resolve()
          : this.updateUxData().catch((err) =>
              this.logger.error(`Error updating UX data\n${err.stack}`),
            ),
      ]);

      await this.addSectionsFromPagesList();

      await this.updateFeedback().catch((err) =>
        this.logger.error(`Error updating Feedback data\n${err.stack}`),
      );

      await this.gcTaskService
        .updateGcTaskData()
        .catch((err) =>
          this.logger.error(`Error updating GC Task data\n${err.stack}`),
        );

      await Promise.allSettled([
        this.calldriversService
          .updateCalldrivers()
          .catch((err) =>
            this.logger.error(`Error updating Calldrivers data\n${err.stack}`),
          ),
      ]);

      await Promise.allSettled([
        this.internalSearchService
          .upsertOverallSearchTerms()
          .catch((err) => this.logger.error(err.stack)),
        this.annotationsService
          .updateAnnotations()
          .catch((err) =>
            this.logger.error(`Error updating Annotations data\n${err.stack}`),
          ),
        this.gcTasksMappingsService
          .updateGCTasksMappings()
          .catch((err) =>
            this.logger.error(
              `Error updating GC Task Mappings data\n${err.stack}`,
            ),
          ),
        this.airtableService
          .updateReports()
          .catch((err) =>
            this.logger.error(`Error updating Reports data\n${err.stack}`),
          ),
      ]);

      await Promise.allSettled([
        this.pageMetricsService
          .updatePageMetrics()
          .catch((err) =>
            this.logger.error(`Error updating Page metrics data\n${err.stack}`),
          ),
        this.airtableService.uploadProjectAttachmentsAndUpdateUrls(),
        this.airtableService.uploadReportAttachmentsAndUpdateUrls(),
      ]);

      await this.createPagesFromPageList().catch((err) =>
        this.logger.error(err.stack),
      );

      await this.internalSearchService
        .upsertPageSearchTerms()
        .catch((err) => this.logger.error(err.stack));

      await this.updateActivityMap().catch((err) =>
        this.logger.error(err.stack),
      );

      await this.pagesService
        .updatePagesLang()
        .catch((err) => this.logger.error(err.stack));

      await this.urlsService
        .updateUrls()
        .catch((err) => this.logger.error(err.stack));

      this.logger.resetContext();

      this.logger.log('Database updates completed.');
    } catch (error) {
      this.logger.error(error);
      this.logger.error(error.stack);
    }
  }

  @AsyncLogTiming
  async createPagesFromPageList() {
    this.logger.log(`Checking for new pages in Published Pages list...`);

    const pagesList = (await this.pagesListModel.find().lean().exec()) ?? [];
    const pagesListUrls = pagesList.map((page) => page.url);

    if (pagesList.length === 0) {
      throw new Error('Published pages list is empty');
    }

    const pagesWithListMatches =
      (await this.pageModel
        .find({
          url: { $in: pagesListUrls },
        })
        .lean()
        .exec()) ?? [];

    const urlsAlreadyInCollection = pagesWithListMatches.map(
      (page) => page.url,
    );

    const pagesToCreate = pagesList
      .filter((page) => !urlsAlreadyInCollection.includes(page.url))
      .map((page) => ({
        _id: new Types.ObjectId(),
        url: page.url,
        title: page.title,
      }));

    this.logger.log(
      `Creating ${pagesToCreate.length} new pages from Published Pages list...`,
    );

    await this.pageModel.insertMany(pagesToCreate, { ordered: false });

    this.logger.log('New pages successfully created');

    this.logger.log('Adding references to page metrics...');

    const bulkWriteOps: AnyBulkWriteOperation<PageMetrics>[] =
      pagesToCreate.map((page) => ({
        updateMany: {
          filter: {
            url: page.url,
            page: null,
          },
          update: {
            $set: {
              page: page._id,
            },
          },
        },
      }));

    const bulkWriteResults =
      await this.pageMetricsModel.bulkWrite(bulkWriteOps);

    if (bulkWriteResults.modifiedCount) {
      this.logger.log(
        `Successfully added references to ${bulkWriteResults.modifiedCount} page metrics`,
      );

      return;
    }

    this.logger.warn(
      `No page metrics found for the following urls: ${JSON.stringify(
        pagesToCreate.map((page) => page.url),
        null,
        2,
      )}`,
    );
  }

  @Retry(4, 1000)
  async updateReports() {
    return this.airtableService.updateReports();
  }

  @Retry(4, 1000)
  async updateUxData(forceVerifyMetricsRefs = false) {
    return this.airtableService.updateUxData(forceVerifyMetricsRefs);
  }

  async updateCalldrivers(endDate?: AbstractDate) {
    return this.calldriversService.updateCalldrivers(endDate);
  }

  @Retry(4, 1000)
  async updateFeedback(endDate?: AbstractDate) {
    await this.feedbackService.updateFeedbackData(endDate);

    const pages: IPage[] = await this.db.collections.pages
      .find({}, { url: 1, tasks: 1, projects: 1 })
      .lean()
      .exec();

    this.logger.log('Syncing feedback references');
    const syncResult = await this.db.collections.feedback.syncReferences(pages);

    this.logger.log(`Successfully synced ${syncResult} feedback references. `);
  }

  async upsertPageMetrics(pageMetrics: PageMetrics[]) {
    const bulkInsertOps = [];

    for (const pageMetric of pageMetrics) {
      const pageMetricNoId = { ...pageMetric };
      const _id = pageMetricNoId._id;
      delete pageMetricNoId._id;

      bulkInsertOps.push({
        updateOne: {
          filter: {
            url: pageMetric.url,
            date: pageMetric.date,
          },
          update: {
            $setOnInsert: {
              _id,
            },
            $set: pageMetricNoId,
          },
          upsert: true,
        },
      });
    }

    return this.pageMetricsModel.bulkWrite(bulkInsertOps);
  }

  async upsertOverallGscMetrics(dates: Date[]) {
    const promises: Promise<IOverall[]>[] = [];

    for (const date of dates) {
      promises.push(this.gscClient.getOverallMetrics(date));

      await wait(600);

      if (promises.length && promises.length % 10 === 0) {
        const bulkWriteOps = (await Promise.all(promises.splice(0)))
          .flat()
          .filter((result) => Object.keys(result).length > 0)
          .map((result) => ({
            updateOne: {
              filter: {
                date: result.date,
              },
              update: {
                $set: result,
              },
              upsert: true,
            },
          }));

        if (bulkWriteOps.length === 0) {
          continue;
        }

        console.log(
          `Writing GSC search terms up to ${bulkWriteOps[
            bulkWriteOps.length - 1
          ].updateOne.filter.date.toISOString()}`,
        );

        await this.overallMetricsModel.bulkWrite(bulkWriteOps);
      }
    }

    const bulkWriteOps = (await Promise.all(promises)).flat().map((result) => ({
      updateOne: {
        filter: {
          date: result.date,
        },
        update: {
          $set: result,
        },
        upsert: true,
      },
    }));

    await this.overallMetricsModel.bulkWrite(bulkWriteOps);
  }

  async upsertGscPageMetrics(dates: Date[]) {
    const bulkWriteOps = [];

    const results = (
      await Promise.all(
        dates.map((date) => this.gscClient.getPageMetrics(date)),
      )
    ).flat(2);

    for (const result of results) {
      bulkWriteOps.push({
        updateOne: {
          filter: {
            url: result.url,
            date: result.date,
          },
          update: {
            $set: result,
          },
        },
      });
    }

    return this.pageMetricsModel.bulkWrite(bulkWriteOps, { ordered: false });
  }

  async repopulateFeedback() {
    return await this.feedbackService.repopulateFeedback();
  }

  async addSectionsFromPagesList() {
    this.logger.log('Adding sections from Published Pages list...');

    try {
      const pagesList = await this.pagesListModel
        .find({
          $or: [{ sections: { $exists: true } }, { owners: { $exists: true } }],
        })
        .lean()
        .exec();

      const bulkWriteOps: AnyBulkWriteOperation<Page>[] = pagesList.map(
        (page) => ({
          updateOne: {
            filter: {
              url: page.url,
            },
            update: {
              $set: {
                sections: page.sections,
                owners: page.owners,
              },
            },
          },
        }),
      );

      return await this.pageModel.bulkWrite(bulkWriteOps, { ordered: false });
    } catch (error) {
      this.logger.error(
        'An error occurred while adding sections from Published Pages list:',
      );
      this.logger.error(error.stack);
    }
  }

  @AsyncLogTiming
  async recalculateViews(logToBlobs = false) {
    if (logToBlobs) {
      this.setBlobLogTargets();
    }

    const dateRangesWithComparison = getDateRangesWithComparison({
      asDate: true,
    }) as DateRange<Date>[];

    try {
      this.logger.info('Clearing unneeded data');

      const deletedPages = await this.db.views.pages.clearUnusedDateRanges(
        dateRangesWithComparison,
      );
      const deletedTasks = await this.db.views.tasks.clearUnusedDateRanges(
        dateRangesWithComparison,
      );

      this.logger.info(
        `Deleted ${deletedPages} PageView documents and ${deletedTasks} TasksView documents`,
      );

      this.logger.info('Loading data for tasks metrics store');

      await this.db.views.tasks.loadStoreData();

      this.logger.info('Data loaded for tasks metrics store');

      for (const dateRange of dateRangesWithComparison) {
        this.logger.info(
          `Recalculating pages view for dateRange: ${JSON.stringify(dateRange, null, 2)}`,
        );

        await this.db.views.pages.performRefresh({
          dateRange,
        });

        this.logger.info(
          `Recalculating tasks view for dateRange: ${JSON.stringify(dateRange, null, 2)}`,
        );

        await this.db.views.tasks.performRefresh({
          dateRange,
        });

        this.logger.info('Date range successfully recalculated.\n');
      }

      this.db.views.tasks.clearStoreData();
    } catch (err) {
      this.logger.error(err.stack);
    }
  }
}
