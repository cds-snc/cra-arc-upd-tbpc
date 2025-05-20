import { ConsoleLogger, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { AnyBulkWriteOperation, Model } from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Overall, Page, PageMetrics, PagesList } from '@dua-upd/db';
import type {
  OverallDocument,
  PageDocument,
  PageMetricsModel,
  PagesListDocument,
} from '@dua-upd/db';
import { DbUpdateService } from '@dua-upd/db-update';
import { outputCsv } from './utils';
import type { IPage } from '@dua-upd/types-common';

dayjs.extend(utc);

@Injectable()
export class DataIntegrityService {
  constructor(
    @InjectModel(Overall.name, 'defaultConnection')
    private overallModel: Model<OverallDocument>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: PageMetricsModel,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
    @InjectModel(PagesList.name, 'defaultConnection')
    private pageListModel: Model<PagesListDocument>,
    private dbUpdateService: DbUpdateService,
    private readonly logger: ConsoleLogger,
  ) {}

  // todo: implement this
  async purgeInvalidPageMetrics(dryRun = true) {
    // Set up query to find all documents with invalid urls

    if (dryRun) {
      return this.pageMetricsModel.find({
        url: { $exists: false },
      });
    }

    return this.pageMetricsModel.deleteMany({ url: { $exists: false } });
  }

  // Can be made a bit more efficient later by checking for what's missing and calling the appropriate method(s)
  async fillMissingData() {
    this.logger.log('Finding and filling missing data...');
    const gscPageResults = await this.fillMissingGscPageMetrics();
    this.logger.log('Results for GSC pages:', gscPageResults);

    const gscOverallResults = await this.fillMissingGscOverallMetrics();
    this.logger.log('Results for GSC overall:', gscOverallResults);

    // todo: add more (i.e. AA, GSC search terms, etc.)
  }

  async findMissingGscPageMetrics() {
    const sixteenMonthsAgo = dayjs(new Date()).subtract(16, 'month').toDate();

    const missingDays = (
      await this.pageMetricsModel
        .find({
          date: {
            $gte: sixteenMonthsAgo,
          },
          url: 'www.canada.ca/en/revenue-agency.html',
          gsc_total_impressions: { $exists: false },
        })
        .exec()
    ).map(({ date }) => date);

    if (missingDays.length === 0) {
      this.logger.log('Found no days in pages_metrics missing gsc data.');
    } else {
      this.logger.log(
        'Found the following days in pages_metrics missing gsc data:',
      );
      this.logger.log(missingDays);
    }

    return missingDays;
  }

  async fillMissingGscPageMetrics() {
    this.logger.log('Finding and filling missing gsc data in pages_metrics...');

    const dates = await this.findMissingGscPageMetrics();

    return await this.dbUpdateService.upsertGscPageMetrics(dates);
  }

  async findMissingGscOverallMetrics() {
    const sixteenMonthsAgo = dayjs(new Date()).subtract(16, 'month').toDate();

    const missingDays = (
      await this.overallModel
        .find(
          {
            date: {
              $gte: sixteenMonthsAgo,
            },
            gsc_total_impressions: { $exists: false },
          },
          {
            _id: 0,
            date: 1,
          },
        )
        .lean()
        .exec()
    ).map((doc) => doc.date);

    if (missingDays.length === 0) {
      this.logger.log('Found no days in overall_metrics missing gsc data.');
    } else {
      this.logger.log(
        'Found the following days in overall_metrics missing gsc data:',
      );
      this.logger.log(missingDays);
    }

    return missingDays;
  }

  async fillMissingGscOverallMetrics() {
    this.logger.log(
      'Finding and filling any missing gsc data in overall_metrics...',
    );

    const dates = await this.findMissingGscOverallMetrics();

    return await this.dbUpdateService.upsertOverallGscMetrics(dates);
  }

  async findInvalidUrls(outputFilePath?: string) {
    // first pages, then page metrics
    const maybeInvalidPages = await this.pageModel
      .find({ url: /\.html.+?\.html/i }, { _id: 0, url: 1 })
      .lean()
      .exec();

    if (outputFilePath) {
      await outputCsv(outputFilePath, maybeInvalidPages as any[]);
      this.logger.log(`Invalid URLs written to ${outputFilePath}`);
    } else {
      this.logger.log('Invalid pages results: ', maybeInvalidPages);
      return maybeInvalidPages;
    }
  }

  async cleanPageUrls() {
    this.logger.log('Cleaning page urls...');

    const pageUrlsToClean = await this.pageModel
      .find({ url: /^https:\/\//i }, { url: 1 })
      .lean()
      .exec();

    this.logger.log('Found the following pages with invalid urls:');
    this.logger.log(
      JSON.stringify(
        pageUrlsToClean.map(({ url }) => url),
        null,
        2,
      ),
    );

    const updates: AnyBulkWriteOperation<IPage>[] = pageUrlsToClean.map(
      ({ _id, url }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { url: url.replace(/^https:\/\//i, '') } },
        },
      }),
    );

    await this.pageModel.bulkWrite(updates, {
      ordered: false,
    });

    this.logger.log('Finished cleaning page urls.');
  }

  async generateMissingDataCsv() {
    const years = [2020, 2021, 2022];

    for (const year of years) {
      const yearQuery = (year: number) => ({
        date: {
          $gte: new Date(`${year}-01-01T00:00:00.000Z`),
          $lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
      });

      const results = await this.pageMetricsModel
        .aggregate()
        .sort({ date: 1 })
        .match({
          ...yearQuery(year),
          $or: [
            { visits: { $gt: 0 } },
            { gsc_total_impressions: { $gt: 0 } },
            { gsc_searchterms: { $not: { $size: 0 } } },
          ],
        })
        .group({
          _id: '$date',
          totalCount: { $sum: 1 },
          hasGsc: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$gsc_total_impressions', null] },
                    { $gt: ['$gsc_total_impressions', 0] },
                  ],
                },
                0,
                1,
              ],
            },
          },
          hasGscTerms: {
            $sum: {
              $cond: [
                { $eq: ['array', { $type: '$gsc_searchterms' }] },
                { $cond: [{ $gt: [{ $size: '$gsc_searchterms' }, 0] }, 1, 0] },
                0,
              ],
            },
          },
          hasAAVisits: {
            $sum: {
              $cond: [
                {
                  $and: [{ $ne: ['$visits', null] }, { $gt: ['$visits', 0] }],
                },
                1,
                0,
              ],
            },
          },
          // hasPageRef: {
          //   $sum: {
          //     $cond: [{ $ne: ['$page', null] }, 1, 0],
          //   },
          // },
        })
        .sort({ _id: 1 })
        .exec();

      await outputCsv(`upd-data_integrity-${year}.csv`, results);
    }
  }
}
