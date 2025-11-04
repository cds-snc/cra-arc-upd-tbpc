import type { AbstractDate, IGCTasks } from '@dua-upd/types-common';
import { AsyncLogTiming } from '@dua-upd/utils-common';
import { ConsoleLogger, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { dayjs, today } from '@dua-upd/utils-common';
import { GcTasks, GcTasksDocument } from '@dua-upd/db';
import { FeedbackService } from '../feedback/feedback.service';

export type GcTaskApiRecord = {
  dateTime: Date;
  timeStamp: string;
  surveyReferrer: string;
  language: string;
  device: string;
  screener: string;
  dept: string;
  theme: string;
  themeOther: string;
  grouping: string;
  task: string;
  taskOther: string;
  taskSatisfaction: string;
  taskEase: string;
  taskCompletion: string;
  taskImprove: string;
  taskImproveComment: string;
  taskWhyNot: string;
  taskWhyNotComment: string;
  taskSampling: string;
  samplingInvitation: string;
  samplingGC: string;
  samplingCanada: string;
  samplingTheme: string;
  samplingInstitution: string;
  samplingGrouping: string;
  samplingTask: string;
};

@Injectable()
export class GcTaskService {
  constructor(
    private logger: ConsoleLogger,
    @InjectModel(GcTasks.name, 'defaultConnection')
    private gcTasksModel: Model<GcTasksDocument>,
    private feedbackService: FeedbackService,
  ) {}

  @AsyncLogTiming
  async updateGcTaskData(endDate?: AbstractDate, useProcessedDate = true) {
    this.logger.log('Updating GC task data');
    const latestDataDate: Date | undefined = (
      await this.gcTasksModel.findOne({}, { date: 1 }).sort({ date: -1 })
    )?.date;

    if (latestDataDate) {
      this.logger.log(`Latest gc task date: ${latestDataDate.toISOString()}`);
    }

    const start = dayjs.utc(latestDataDate || '2020-01-01').add(1, 'day');

    const end = endDate || today().subtract(1, 'day');

    if (latestDataDate && dayjs.utc(latestDataDate).isSame(end)) {
      this.logger.log('GC task data already up-to-date.');
      return;
    }

    const startDateProperty = useProcessedDate
      ? 'processedStartDate'
      : 'startDate';

    const endDateProperty = useProcessedDate ? 'processedEndDate' : 'endDate';

    const url = new URL(`${process.env.FEEDBACK_API_HOST}/api/toptasks`);

    const params = {
      [startDateProperty]: start.format('YYYY-MM-DD'),
      [endDateProperty]: dayjs.utc(end).format('YYYY-MM-DD'),
      ['institution']: 'CRA / ARC',
    };

    url.search = new URLSearchParams(params).toString();

    this.logger.log(
      `Fetching GC Tasks data for date range: ${params[startDateProperty]} - ${params[endDateProperty]}`,
    );

    const headers = {
      Authorization: `Bearer ${await this.feedbackService.getFeedbackAuthToken()}`,
    };

    const results = await fetch(url, {
      headers,
    }).then(async (res) => res.json() as Promise<GcTaskApiRecord[]>);

    this.logger.log(`${results.length} total new GC Task records`);

    this.logger.log('Parsing GC Task data...');

    const gcTask: IGCTasks[] = results.map(
      ({
        dateTime,
        timeStamp,
        surveyReferrer,
        language,
        device,
        screener,
        dept,
        theme,
        themeOther,
        grouping,
        task,
        taskOther,
        taskSatisfaction,
        taskEase,
        taskCompletion,
        taskImprove,
        taskImproveComment,
        taskWhyNot,
        taskWhyNotComment,
        taskSampling,
        samplingInvitation,
        samplingGC,
        samplingCanada,
        samplingTheme,
        samplingInstitution,
        samplingGrouping,
        samplingTask,
      }) => ({
        _id: new Types.ObjectId(),
        date: new Date(dateTime),
        time_stamp: timeStamp,
        language,
        device,
        url: surveyReferrer.replace(/^https:\/\//, ''),
        screener: screener == 'Yes / Oui',
        department: separateEnglish(dept),
        theme: separateEnglish(theme),
        theme_other: themeOther,
        grouping: separateEnglish(grouping),
        gc_task: separateEnglish(task),
        gc_task_other: taskOther,
        satisfaction: separateEnglish(taskSatisfaction),
        ease: separateEnglish(taskEase),
        able_to_complete: separateEnglish(taskCompletion),
        what_would_improve: separateEnglish(taskImprove),
        what_would_improve_comment: taskImproveComment,
        reason_not_complete: separateEnglish(taskWhyNot),
        reason_not_complete_comment: taskWhyNotComment,
        sampling: taskSampling,
        sampling_invitation: samplingInvitation,
        sampling_gc: samplingGC,
        sampling_canada: samplingCanada,
        sampling_theme: samplingTheme,
        sampling_institution: samplingInstitution,
        sampling_group: samplingGrouping,
        sampling_task: samplingTask,
      }),
    );

    return await this.gcTasksModel
      .insertMany(gcTask)
      .then(() =>
        this.logger.log(`Successfully added ${gcTask.length} GC Tasks data`),
      )
      .catch((err) => {
        this.logger.error('Error updating gc task data');
        this.logger.error(err);
      });
  }

  async repopulateGcTask() {
    this.logger.log(
      'Repopulating GC Tasks data... This may take several minutes.',
    );

    await this.gcTasksModel.deleteMany({});

    await this.updateGcTaskData(undefined, false);

    this.logger.log('Finished repopulating GC Tasks data.');
  }
}

function separateEnglish(str: string): string {
  const parts = str.split(' / ');
  return parts[0] && parts[0].length > 0 ? parts[0] : '';
}
