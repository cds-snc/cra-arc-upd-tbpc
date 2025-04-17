import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cache } from 'cache-manager';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { ProjectDocument } from '@dua-upd/db';
import { Project, Reports } from '@dua-upd/db';
import type {
  AttachmentData,
  IReports,
  ReportsData,
  ReportsHomeProject,
} from '@dua-upd/types-common';

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

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Project.name, 'defaultConnection')
    private projectsModel: Model<ProjectDocument>,
    @InjectModel(Reports.name, 'defaultConnection')
    private reportsModel: Model<Reports>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getReportsData(): Promise<ReportsData> {
    const cacheKey = `getReportsData`;
    const cachedData = await this.cacheManager.store.get<ReportsData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const tasksData = (await this.reportsModel
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

    const projectsData = await this.projectsModel
      .aggregate<ReportsHomeProject>()
      .lookup({
        from: 'ux_tests',
        let: { project_id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$project', '$$project_id'],
              },
            },
          },
          {
            $group: {
              _id: null,
              cops: {
                $max: '$cops',
              },
              startDate: {
                $min: '$date',
              },
              launchDate: {
                $max: '$launch_date',
              },
              uxTests: {
                $push: {
                  success_rate: '$success_rate',
                  date: '$date',
                  test_type: '$test_type',
                },
              },
              avgSuccessRate: {
                $avg: '$success_rate',
              },
              statuses: {
                $addToSet: '$status',
              },
            },
          },
          {
            $addFields: {
              status: projectStatusSwitchExpression,
            },
          },
        ],
        as: 'tests_aggregated',
      })
      .unwind('$tests_aggregated')
      .replaceRoot({
        $mergeObjects: ['$$ROOT', '$tests_aggregated', { _id: '$_id' }],
      })
      .project({
        title: 1,
        cops: 1,
        startDate: 1,
        launchDate: 1,
        avgSuccessRate: 1,
        status: 1,
        uxTests: 1,
        attachments: 1,
      });

    projectsData.map((project) => {
      return {
        ...project,
        attachment: processAttachments(project.attachments),
      };
    });

    tasksData.map((task) => {
      return {
        ...task,
        en_attachment: processAttachments(task.en_attachment),
        fr_attachment: processAttachments(task.fr_attachment),
      };
    });

    const results = {
      projects: projectsData,
      tasks: tasksData,
    };

    await this.cacheManager.set(cacheKey, results);

    return results;
  }
}

function processAttachments(attachments: AttachmentData[]) {
  return attachments?.map((attachment) => {
    attachment.storage_url = attachment.storage_url?.replace(/^https:\/\//, '');
    return attachment;
  });
}
