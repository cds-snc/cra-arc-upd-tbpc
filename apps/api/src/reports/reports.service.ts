import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { omit } from 'rambdax';
import { DbService } from '@dua-upd/db';
import type {
  IProject,
  IReports,
  OverviewProject,
  ReportsData,
  ReportsHomeProject,
} from '@dua-upd/types-common';
import { arrayToDictionary } from '@dua-upd/utils-common';

dayjs.extend(utc);

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
      {
        case: {
          $in: ['Exploratory', '$statuses'],
        },
        then: 'Exploratory',
      },
      {
        case: {
          $in: ['Monitoring', '$statuses'],
        },
        then: 'Monitoring',
      },
      {
        case: {
          $in: ['Needs review', '$statuses'],
        },
        then: 'Needs review',
      },
      {
        case: {
          $in: ['Paused', '$statuses'],
        },
        then: 'Paused',
      },
    ],
    default: 'Unknown',
  },
};

const DOCUMENTS_URL = () => process.env.DOCUMENTS_URL || '';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DbService)
    private db: DbService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getReportsData(): Promise<ReportsData> {
    const cacheKey = `getReportsData`;
    const cachedData = await this.cacheManager.store.get<ReportsData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const documentsUrl = DOCUMENTS_URL();

    const tasksData = (await this.db.collections.reports
      .find(
        { type: 'tasks' },
        {
          en_title: 1,
          fr_title: 1,
          en_attachment: 1,
          fr_attachment: 1,
        },
      )
      .lean()
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

    const projectAttachments: Pick<IProject, '_id' | 'attachments'>[] =
      await this.db.collections.projects
        .find({ attachments: { $ne: [] } }, { attachments: 1 })
        .lean()
        .exec()
        .then((projects) =>
          projects.map((project) => ({
            _id: project._id,
            attachments: project.attachments?.map((attachment) => ({
              ...attachment,
              storage_url: `${documentsUrl}${attachment.storage_url}`,
            })),
          })),
        );

    const projectAttachmentsDict = arrayToDictionary(projectAttachments, '_id');

    const projectsData = await this.db.collections.uxTests
      .aggregate<OverviewProject>()
      .group({
        _id: '$project',
        title: { $first: '$title' },
        cops: { $max: '$cops' },
        startDate: { $min: '$date' },
        statuses: { $addToSet: '$status' },
      })
      .addFields({
        status: projectStatusSwitchExpression,
      })
      .project({
        _id: { $toString: '$_id' },
        title: 1,
        cops: 1,
        startDate: 1,
        status: 1,
      })
      .sort({
        startDate: -1,
      })
      .exec();

    const includedProjects = Object.keys(projectAttachmentsDict);

    const projectsWithAttachments = projectsData
      .filter((project) => includedProjects.includes(project._id))
      .map((project) => ({
        _id: project._id,
        title: project.title,
        attachments: projectAttachmentsDict[project._id]?.attachments || [],
        cops: !!project.cops,
        startDate: project.startDate,
        status: project.status,
      }));

    const results = {
      projects: projectsWithAttachments satisfies ReportsHomeProject[],
      tasks: tasksData,
    };

    await this.cacheManager.set(cacheKey, results);

    return results;
  }
}
