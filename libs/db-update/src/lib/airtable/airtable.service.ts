import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { AnyBulkWriteOperation, FilterQuery, Model } from 'mongoose';
import { BlobStorageService } from '@dua-upd/blob-storage';
import {
  CallDriver,
  Feedback,
  Page,
  PageMetrics,
  PagesList,
  Project,
  Task,
  UxTest,
  Reports,
} from '@dua-upd/db';
import {
  AirtableClient,
  PageData,
  TaskData,
  UxTestData,
} from '@dua-upd/external-data';
import { BlobLogger } from '@dua-upd/logger';
import type {
  AttachmentData,
  IPage,
  IProject,
  ITask,
  IUxTest,
} from '@dua-upd/types-common';
import {
  arrayToDictionary,
  logJson,
  WithObjectId,
} from '@dua-upd/utils-common';
import type { UxApiData, UxApiDataType, UxData } from './types';
import { assertHasUrl, assertObjectId } from './utils';
import { difference, uniq } from 'rambdax';

@Injectable()
export class AirtableService {
  constructor(
    @Inject(AirtableClient.name) private airtableClient: AirtableClient,
    @Inject('DB_UPDATE_LOGGER')
    private logger: BlobLogger,
    @InjectModel(CallDriver.name, 'defaultConnection')
    private calldriverModel: Model<CallDriver>,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedbackModel: Model<Feedback>,
    @InjectModel(Page.name, 'defaultConnection') private pageModel: Model<Page>,
    @InjectModel(PagesList.name, 'defaultConnection')
    private pageListModel: Model<PagesList>,
    @InjectModel(Project.name, 'defaultConnection')
    private projectModel: Model<Project>,
    @InjectModel(Task.name, 'defaultConnection') private taskModel: Model<Task>,
    @InjectModel(UxTest.name, 'defaultConnection')
    private uxTestModel: Model<UxTest>,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: Model<PageMetrics>,
    @InjectModel(Reports.name, 'defaultConnection')
    private reportsModel: Model<Reports>,
    @Inject(BlobStorageService.name)
    private blobService: BlobStorageService,
  ) {}

  async pagesHaveChanged(
    currentPages: IPage[],
    pagesDict: Record<string, IPage>,
    newPages: IPage[],
  ): Promise<boolean> {
    // compare pages and relationships to current data -> skip updating refs if nothing has changed
    const refArraysAreTheSame = (a: Types.ObjectId[], b: Types.ObjectId[]) => {
      if (a?.length !== b?.length) {
        return false;
      }

      const normalizedA = JSON.stringify(a?.map((id) => id.toString()).sort());
      const normalizedB = JSON.stringify(b?.map((id) => id.toString()).sort());

      return normalizedA === normalizedB;
    };

    if (currentPages.length !== newPages.length) {
      console.log('current pages and new pages are different lengths');
      console.log(
        `currentPages: ${currentPages.length} - newPages: ${newPages.length}`,
      );

      return true;
    }

    for (const page of currentPages) {
      const newPage = pagesDict[page._id.toString()];

      if (!newPage) {
        console.log('no newPage?');
        return true;
      }

      const tasksChanged = !refArraysAreTheSame(
        page.tasks as Types.ObjectId[],
        (newPage.tasks || []) as Types.ObjectId[],
      );

      const projectsChanged = !refArraysAreTheSame(
        page.projects as Types.ObjectId[],
        (newPage.projects || []) as Types.ObjectId[],
      );

      const uxTestsChanged = !refArraysAreTheSame(
        page.ux_tests as Types.ObjectId[],
        (newPage.ux_tests || []) as Types.ObjectId[],
      );

      if (tasksChanged || projectsChanged || uxTestsChanged) {
        return true;
      }
    }
  }

  async getUxData(): Promise<UxApiData> {
    this.logger.log('Getting data from Airtable...');
    const tasksData = await this.airtableClient.getTasks();
    const uxTestData = await this.airtableClient.getUxTests();
    const pageData = await this.airtableClient.getPages();
    const tasksTopicsMap = await this.airtableClient.getTasksTopicsMap();

    return { tasksData, uxTestData, pageData, tasksTopicsMap };
  }

  // function to help with getting or creating objectIds, and populating an airtableId to ObjectId map to add references
  private async addObjectIdsAndPopulateIdsMap<
    T extends { _id: Types.ObjectId; airtable_id?: string },
  >(
    data: UxApiDataType[],
    model: Model<T>,
    idsMap: Map<string, Types.ObjectId>,
  ): Promise<WithObjectId<UxApiDataType>[]> {
    const airtableIds = data.map((doc) => doc.airtable_id);

    const airtableFilter = { airtable_id: { $in: airtableIds } };

    const urlFilter: FilterQuery<Page> = {};

    if (model.modelName === 'Page') {
      assertHasUrl(data);

      const urls = data.map((doc) => doc.url.replace(/^https:\/\//i, ''));

      urlFilter['url'] = { $in: urls };
    }

    const existingDataFilter =
      model.modelName === 'Page' ? urlFilter : airtableFilter;

    const existingData = ((await model
      .find(existingDataFilter)
      .lean()
      .exec()) || []) as T[];

    for (const doc of existingData) {
      idsMap.set(doc.airtable_id, doc._id);
    }

    const urlsDict = Object.fromEntries(
      existingData.map((page: T) => ('url' in page ? [page.url, page] : [])),
    );

    return data.map((doc) => {
      if (!idsMap.get(doc.airtable_id)) {
        idsMap.set(
          doc.airtable_id,
          urlsDict[doc['url']]?._id || new Types.ObjectId(),
        );
      }
      return { ...doc, _id: idsMap.get(doc.airtable_id) };
    });
  }

  private async getProjectsFromUxTests(
    uxTestsWithIds: WithObjectId<UxTestData>[],
    idMaps: {
      tasks: Map<string, Types.ObjectId>;
      uxTests: Map<string, Types.ObjectId>;
      pages: Map<string, Types.ObjectId>;
    },
  ): Promise<IProject[]> {
    const projectTitles = [
      ...new Set(uxTestsWithIds.map((uxTest) => uxTest.title)),
    ];

    const existingProjects = (await this.projectModel
      .find({ title: { $in: projectTitles } }, { _id: true, title: true })
      .lean()) as { _id: Types.ObjectId; title: string }[];

    return projectTitles.map((projectTitle) => {
      const uxTests = uxTestsWithIds.filter(
        (uxTest) => uxTest.title === projectTitle,
      );

      const pageAirtableIds = [
        ...uxTests.reduce((pageIds, uxTest) => {
          for (const pageId of uxTest.pages || []) {
            pageIds.add(pageId);
          }

          return pageIds;
        }, new Set()),
      ] as string[];

      const pageObjectIds = [
        ...new Set(
          pageAirtableIds.map((pageAirtableId) =>
            idMaps.pages.get(pageAirtableId),
          ),
        ),
      ] as Types.ObjectId[];

      const taskAirtableIds = [
        ...uxTests.reduce((taskIds, uxTest) => {
          for (const taskId of uxTest.tasks || []) {
            taskIds.add(taskId);
          }

          return taskIds;
        }, new Set()),
      ] as string[];

      const taskObjectIds = taskAirtableIds.map((taskAirtableId) =>
        idMaps.tasks.get(taskAirtableId),
      );

      const existingProject = existingProjects.find(
        (project) => project.title === projectTitle,
      );

      // get de-duplicated attachments
      const attachments = uxTests.reduce(
        (attachments, uxTest) => {
          for (const attachment of uxTest.attachments || []) {
            if (!attachments[attachment.filename]) {
              attachments[attachment.filename] = attachment;
            }
          }

          return attachments;
        },
        {} as Record<string, AttachmentData>,
      );

      return {
        _id: existingProject?._id || new Types.ObjectId(),
        title: projectTitle,
        ux_tests: uxTests.map((uxTest) => uxTest._id),
        pages: pageObjectIds,
        tasks: taskObjectIds,
        description: uxTests.find((uxTest) => uxTest.description)?.description,
        attachments: Object.values(attachments),
      };
    }) as IProject[];
  }

  async updateReports() {
    this.logger.log('Writing Reports to db');

    const reportUpdateOps = (await this.airtableClient.getReports()).map(
      (report) => ({
        updateOne: {
          filter: { airtable_id: report.airtable_id },
          update: { $set: report },
          upsert: true,
        },
      }),
    );

    await this.reportsModel.bulkWrite(reportUpdateOps);

    this.logger.log('Successfully updated the Reports data');
  }

  async getAndPrepareUxData(): Promise<UxData> {
    const { tasksData, uxTestData, pageData, tasksTopicsMap } =
      await this.getUxData();

    const airtableIdToObjectIdMaps = {
      tasks: new Map<string, Types.ObjectId>(),
      uxTests: new Map<string, Types.ObjectId>(),
      pages: new Map<string, Types.ObjectId>(),
    };

    const tasksWithIds = (await this.addObjectIdsAndPopulateIdsMap<Task>(
      tasksData,
      this.taskModel,
      airtableIdToObjectIdMaps.tasks,
    )) as WithObjectId<TaskData>[];

    const uxTestsWithIds = (await this.addObjectIdsAndPopulateIdsMap<UxTest>(
      uxTestData,
      this.uxTestModel,
      airtableIdToObjectIdMaps.uxTests,
    )) as WithObjectId<UxTestData>[];

    const pagesWithIds = (await this.addObjectIdsAndPopulateIdsMap<Page>(
      pageData,
      this.pageModel,
      airtableIdToObjectIdMaps.pages,
    )) as WithObjectId<PageData>[];

    const projectsWithRefs = await this.getProjectsFromUxTests(
      uxTestsWithIds,
      airtableIdToObjectIdMaps,
    );

    // finally, add all missing refs each data type
    const uxTestsWithRefs = uxTestsWithIds.map((uxTest) => {
      const project = projectsWithRefs.find(
        (project) => project.title === uxTest.title,
      );

      const pages = [
        ...new Set(
          (uxTest.pages || []).map((pageAirtableId) =>
            airtableIdToObjectIdMaps.pages.get(pageAirtableId),
          ),
        ),
      ] as Types.ObjectId[];

      return {
        ...uxTest,
        project: project?._id,
        pages,
        tasks: (uxTest.tasks || []).map((taskAirtableId) =>
          airtableIdToObjectIdMaps.tasks.get(taskAirtableId),
        ),
      } as IUxTest;
    });

    const tasksWithRefs = tasksWithIds.map((task) => {
      const ux_tests = uxTestsWithRefs.filter((uxTest) => {
        if (uxTest.tasks) {
          assertObjectId(uxTest.tasks as Types.ObjectId[]);

          return (uxTest.tasks as Types.ObjectId[])?.includes(task._id);
        }
      });

      const projects = [
        ...new Set(ux_tests.map((uxTest) => uxTest.project)),
      ] as Types.ObjectId[];

      const tpc_ids = tasksTopicsMap[task.airtable_id] || [];

      const pages = [
        ...new Set(
          (task.pages || []).map((pageAirtableId) =>
            airtableIdToObjectIdMaps.pages.get(pageAirtableId),
          ),
        ),
      ] as Types.ObjectId[];

      return {
        ...task,
        ux_tests: ux_tests.map((uxTest) => uxTest._id) as Types.ObjectId[],
        projects,
        pages,
        tpc_ids,
      } as ITask;
    });

    const pagesWithRefs = pagesWithIds.map((page) => {
      const ux_tests = uxTestsWithRefs.filter((uxTest) => {
        if (uxTest.pages) {
          assertObjectId(uxTest.pages as Types.ObjectId[]);

          return (uxTest.pages as Types.ObjectId[])?.includes(page._id);
        }
      });

      const projects = [
        ...new Set(ux_tests.map((uxTest) => uxTest.project)),
      ] as Types.ObjectId[];

      const tasks = page.tasks?.map((taskAirtableId) =>
        airtableIdToObjectIdMaps.tasks.get(taskAirtableId),
      );

      return {
        ...page,
        ux_tests: ux_tests.map((uxTest) => uxTest._id) as Types.ObjectId[],
        projects,
        tasks,
      } as IPage;
    });

    return {
      tasks: tasksWithRefs,
      uxTests: uxTestsWithRefs,
      pages: pagesWithRefs,
      projects: projectsWithRefs,
    };
  }

  async updateUxData(forceVerifyMetricsRefs = false) {
    // don't await it yet so that we can do db queries while we're waiting
    const uxDataPromise = this.getAndPrepareUxData();

    // get current page ids to compare to airtable pages
    const currentPages =
      (await this.pageModel
        .find({
          $or: [
            { airtable_id: { $exists: true } },
            { 'tasks.0': { $exists: true } },
            { 'projects.0': { $exists: true } },
          ],
        })
        .lean()
        .exec()) || [];

    const { tasks, uxTests, pages, projects } = await uxDataPromise;

    const pagesDict = arrayToDictionary(pages, '_id', true);

    // see if any pages are in the db but are no longer in airtable
    // if so, they've "been removed", so we unset airtable_id and refs
    const removedPages = currentPages.filter(
      (page) => !pagesDict[page._id.toString()],
    );

    const pageRemoveOps: AnyBulkWriteOperation<Page>[] = removedPages.map(
      (page) => ({
        updateOne: {
          filter: { _id: page._id },
          update: {
            $unset: { airtable_id: '', tasks: '', projects: '', ux_tests: '' },
          },
        },
      }),
    );

    const existingMetricsPageIds = new Set(
      (await this.pageMetricsModel.distinct('page')).map((id) => id.toString()),
    );

    // unset refs on metrics
    const metricsUnsetRefsOps: AnyBulkWriteOperation<PageMetrics>[] =
      removedPages
        .filter((page) => existingMetricsPageIds.has(page._id.toString()))
        .map((page) => ({
          updateMany: {
            filter: { page: page._id },
            update: { $unset: { tasks: '', projects: '', ux_tests: '' } },
          },
        }));

    // update pages
    const pageUpdateOps: AnyBulkWriteOperation<Page>[] = pages.map((page) => ({
      updateOne: {
        filter: { _id: page._id },
        update: {
          $setOnInsert: { _id: page._id, title: page.title, url: page.url },
          $set: {
            airtable_id: page.airtable_id,
            lang: page.url
              .match(/(?<=www\.canada\.ca\/)(?:en|fr)/i)?.[0]
              ?.toLowerCase(),
            tasks: page.tasks || [],
            projects: page.projects || [],
            ux_tests: page.ux_tests || [],
          },
        },
        upsert: true,
      },
    }));

    // commit the updates prepared so far

    this.logger.log('Writing Pages to db');

    await this.pageModel.bulkWrite(pageUpdateOps, { ordered: false });

    if (pageRemoveOps.length) {
      this.logger.log(`${removedPages.length} Pages removed from airtable:`);

      const removedPagesData = await this.pageModel
        .find({ _id: { $in: removedPages } }, { url: 1 })
        .lean()
        .exec();

      logJson(removedPagesData);

      this.logger.log(`removing references from deleted pages`);

      await this.pageModel.bulkWrite(pageRemoveOps);

      this.logger.log(`removing references from associated metrics`);

      const metricsWriteResults = await this.pageMetricsModel.bulkWrite(
        metricsUnsetRefsOps,
        { ordered: false },
      );

      this.logger.log(
        `Removed references from ${metricsWriteResults.modifiedCount} metrics documents`,
      );
    }

    // update tasks
    const taskUpdateOps = tasks.map((task) => ({
      replaceOne: {
        filter: { _id: task._id },
        replacement: task as Task,
        upsert: true,
      },
    }));

    this.logger.log('Writing Tasks to db');
    await this.taskModel.bulkWrite(taskUpdateOps);

    // update ux tests
    const uxTestUpdateOps = uxTests.map((uxTest) => ({
      replaceOne: {
        filter: { _id: uxTest._id },
        replacement: uxTest as UxTest,
        upsert: true,
      },
    }));

    this.logger.log('Writing UX tests to db');
    await this.uxTestModel.bulkWrite(uxTestUpdateOps);

    // update projects
    const projectUpdateOps: AnyBulkWriteOperation<Project>[] = projects.map(
      (project) => ({
        replaceOne: {
          filter: { _id: project._id },
          replacement: project,
          upsert: true,
        },
      }),
    );

    this.logger.log('Writing Projects to db');
    await this.projectModel.bulkWrite(projectUpdateOps);

    const pagesChanged = await this.pagesHaveChanged(
      currentPages,
      pagesDict,
      pages,
    );

    console.log('pages have changed: ', pagesChanged);

    if (forceVerifyMetricsRefs || pagesChanged) {
      let numPagesWithChangedRefs = 0;
      let totalModifiedDocs = 0;

      // update metrics refs
      this.logger.log('Syncing pages_metrics references');

      const distinctUrls =
        (await this.pageMetricsModel.distinct('url').lean().exec()) || [];

      const distinctUrlsSet = new Set(distinctUrls);

      // set refs on metrics using page ids
      for (const page of pages.filter((page) =>
        distinctUrlsSet.has(page.url),
      )) {
        console.log(`Syncing metrics for page: ${page._id} (${page.url})`);
        // Assuming all refs for individual pages are the same,
        // but this may not be a safe assumption!
        const currentRefs = (await this.pageMetricsModel
          .findOne(
            {
              url: page.url,
            },
            {
              url: 1,
              page: 1,
              tasks: 1,
              projects: 1,
              ux_tests: 1,
            },
          )
          .lean()
          .exec()) as {
          url: string;
          page: Types.ObjectId;
          tasks?: Types.ObjectId[];
          projects?: Types.ObjectId[];
          ux_tests?: Types.ObjectId[];
        } | null;

        if (!currentRefs) {
          this.logger.warn(
            `No current refs found for page ${page._id} (${page.url})`,
          );
          continue;
        }

        const mapToString = (arr: Types.ObjectId[]) =>
          arr.map((id) => id.toString());

        const refsAreDifferent = <T extends unknown[]>(
          existingRefs?: Types.ObjectId[] | null,
          newRefs?: T | null,
        ) =>
          existingRefs?.length !== newRefs?.length ||
          difference(
            mapToString(existingRefs || []),
            mapToString((newRefs || []) as Types.ObjectId[]),
          ).length > 0;

        if (
          !currentRefs.page.equals(page._id) ||
          refsAreDifferent(currentRefs.tasks, page.tasks) ||
          refsAreDifferent(currentRefs.projects, page.projects) ||
          refsAreDifferent(currentRefs.ux_tests, page.ux_tests)
        ) {
          console.log(`Refs have changed for page: ${page.url}`);
          numPagesWithChangedRefs++;

          try {
            console.time(`${page.url} updated.`);

            const updateResults = await this.pageMetricsModel.updateMany(
              { url: page.url },
              {
                $set: {
                  page: page._id,
                  tasks: page.tasks,
                  projects: page.projects,
                  ux_tests: page.ux_tests,
                },
              },
            );

            console.log(
              `Refs updated for ${updateResults.modifiedCount} documents.`,
            );
            totalModifiedDocs += updateResults.modifiedCount;
            console.timeEnd(`${page.url} updated.`);
          } catch (error) {
            console.error('Error trying to update refs with:');
            logJson({
              $set: {
                tasks: page.tasks,
                projects: page.projects,
                ux_tests: page.ux_tests,
              },
            });
          }
        }
      }

      console.log(`Updated references for ${numPagesWithChangedRefs} pages`);
      console.log(`${totalModifiedDocs} documents modified in total`);

      // get ids of non-airtable pages
      const dbPageIds = (await this.pageModel.distinct('_id')).map((id) =>
        id.toString(),
      );

      const metricsPageIds = (await this.pageMetricsModel.distinct('page'))
        ?.filter((id) => id)
        .map((id) => id.toString());

      // find any page refs for pages that don't exist anymore
      const danglingPageIds = difference(metricsPageIds, dbPageIds);

      if (danglingPageIds.length) {
        this.logger.log(
          `Removing references from metrics documents for ${danglingPageIds.length} dangling page references:`,
        );

        let totalRemoveRefModifiedCount = 0;

        for (const pageId of danglingPageIds) {
          this.logger.log(`Removing dangling page ref for ${pageId}`);

          console.time(`Removed dangling page ref for ${pageId}`);

          const metricsRemoveRefsResults =
            await this.pageMetricsModel.updateMany(
              { page: new Types.ObjectId(pageId) },
              {
                $unset: { page: '', tasks: '', projects: '', ux_tests: '' },
              },
            );

          console.timeEnd(`Removed dangling page ref for ${pageId}`);

          totalRemoveRefModifiedCount += metricsRemoveRefsResults.modifiedCount;
        }

        this.logger.log(
          `Removed page references from ${totalRemoveRefModifiedCount} metrics documents`,
        );
      }
    }

    // Prune removed data

    this.logger.log('Pruning old Tasks');
    const currentTaskAirtableIds = tasks.map((task) => task.airtable_id);
    const taskPruningResults = await this.taskModel.deleteMany({
      airtable_id: { $nin: currentTaskAirtableIds },
    });
    this.logger.log(`Pruned ${taskPruningResults.deletedCount} Tasks`);

    this.logger.log('Pruning old UX tests');
    const currentUxTestAirtableIds = uxTests.map(
      (uxTest) => uxTest.airtable_id,
    );
    const uxTestPruningResults = await this.uxTestModel.deleteMany({
      airtable_id: { $nin: currentUxTestAirtableIds },
    });
    this.logger.log(`Pruned ${uxTestPruningResults.deletedCount} UX tests`);

    this.logger.log('Pruning old Projects');
    const currentProjectIds = projects.map((project) => project._id);
    const projectPruningResults = await this.projectModel.deleteMany({
      _id: { $nin: currentProjectIds },
    });
    this.logger.log(`Pruned ${projectPruningResults.deletedCount} Projects`);

    this.logger.log('Successfully updated Airtable data');
  }

  async updatePagesList() {
    this.logger.log('Updating Published Pages list from Airtable');
    const currentPagesList =
      (await this.pageListModel.find().sort({ updatedAt: -1 }).lean().exec()) ||
      [];

    const currentUrlsDict = arrayToDictionary(currentPagesList, 'url');

    const lastUpdated = currentPagesList.length
      ? currentPagesList[0].updatedAt
      : new Date(0);

    const airtableList = await this.airtableClient.getPagesList(lastUpdated);

    if (airtableList.length === 0) {
      return;
    }

    const updatedPages = airtableList.filter(
      (page) => page.url && currentUrlsDict[page.url],
    );

    const updateOps = updatedPages.map((page) => ({
      updateOne: { filter: { url: page.url }, update: page },
    }));

    const newPages = airtableList.filter(
      (page) => page.url && !currentUrlsDict[page.url],
    );

    const newPagesWithIds = newPages.map((page) => ({
      _id: new Types.ObjectId(),
      ...page,
    }));

    await this.pageListModel.insertMany(newPagesWithIds);

    return this.pageListModel.bulkWrite(updateOps);
  }

  async getPagesList() {
    const publishedPagesList =
      (await this.pageListModel.find().lean().exec()) || [];

    if (publishedPagesList.length === 0) {
      throw new Error('No pages found in page list');
    }

    return publishedPagesList;
  }

  async uploadProjectAttachmentsAndUpdateUrls() {
    const projectsWithAttachments = await this.projectModel
      .find(
        { attachments: { $not: { $size: 0 } } },
        { title: 1, attachments: 1 },
      )
      .exec();

    const promises = [];

    for (const project of projectsWithAttachments) {
      const promise = Promise.all(
        project.attachments.map(async ({ url, filename, size }) => {
          const blobClient =
            this.blobService.blobModels.project_attachments.blob(filename);

          try {
            await blobClient.copyFromUrlIfDifferent(url, size);

            return {
              blobFilename: blobClient.filename,
              blobUrl: blobClient.url,
            };
          } catch (err) {
            this.logger.error(
              `An error occurred uploading attachment: ${filename}`,
            );

            throw err;
          }
        }),
      )
        .then((results) => {
          for (const { blobFilename, blobUrl } of results) {
            const attachmentIndex = project.attachments.findIndex(
              ({ filename }) => filename === blobFilename,
            );

            project.attachments[attachmentIndex].storage_url = blobUrl;
          }

          return project.save();
        })
        .catch((err) =>
          this.logger.error(
            `An error occurred uploading attachments for ${project.title}: \n${err.stack}`,
          ),
        );

      promises.push(promise);
    }

    const results = await Promise.allSettled(promises);

    const rejectedResults = results.filter(
      (result) => result.status === 'rejected',
    );

    if (rejectedResults.length) {
      this.logger.error(
        `${rejectedResults.length} Projects had errors uploading attachments`,
      );
    }

    this.logger.log('Finished uploading attachments');
  }

  async uploadReportAttachmentsAndUpdateUrls() {
    const reportsWithAttachments = await this.reportsModel
      .find(
        {
          $or: [
            { 'en_attachment.0': { $exists: true } },
            { 'fr_attachment.0': { $exists: true } },
          ],
        },
        { title: 1, en_attachment: 1, fr_attachment: 1 },
      )
      .exec();

    for (const report of reportsWithAttachments) {
      try {
        for (const attachments of [
          report['en_attachment'],
          report['fr_attachment'],
        ]) {
          for (const [i, { url, filename, size }] of attachments.entries()) {
            const blobClient =
              this.blobService.blobModels.reports.blob(filename);

            await blobClient.copyFromUrlIfDifferent(url, size);

            attachments[i].storage_url = blobClient.url;
          }
        }

        await report.save();
      } catch (err) {
        this.logger.error(
          `An error occurred uploading attachments for ${report.en_title}:`,
        );
        this.logger.error(err.stack);
      }
    }

    this.logger.log('Finished uploading attachments');
  }
}
