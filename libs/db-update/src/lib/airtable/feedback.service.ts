import { AbstractDate, DateRange, IFeedback } from '@dua-upd/types-common';
import { AsyncLogTiming } from '@dua-upd/utils-common';
import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { dayjs, type Dayjs, today } from '@dua-upd/utils-common';

import { AirtableClient } from '@dua-upd/external-data';
import { Feedback } from '@dua-upd/db';
import type { FeedbackDocument } from '@dua-upd/db';

@Injectable()
export class FeedbackService {
  constructor(
    @Inject(AirtableClient.name) private airtableClient: AirtableClient,
    private logger: ConsoleLogger,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedbackModel: Model<FeedbackDocument>,
  ) {}

  @AsyncLogTiming
  async updateFeedbackData(endDate?: AbstractDate) {
    this.logger.log('Updating Feedback data');

    const newFeedback: IFeedback[] = [];

    const latestDataDate: Date | undefined = (
      await this.feedbackModel.findOne({}, { date: 1 }).sort({ date: -1 }).lean().exec()
    )?.date;

    const start = dayjs
      .utc(latestDataDate || '2020-01-01')
      .add(1, 'day');

    const end = endDate || (today().subtract(1, 'day'));

    // if the db is empty, we can skip this part
    if (latestDataDate) {
      // check for late additions separately, that way we have fewer records to check
      const lateAdditionsStart = dayjs
        .utc(latestDataDate || '2020-01-01')
        .subtract(14, 'days')
        .startOf('day');

      const lateAdditionsEnd = (start as Dayjs).subtract(1, 'day');

      const existingFeedback =
        (await this.feedbackModel
          .find({
            date: {
              $gte: lateAdditionsStart,
              $lte: lateAdditionsEnd,
            },
            unique_id: { $exists: true },
          })
          .lean()
          .exec()) || [];

      const existingIds = new Set<string>(
        existingFeedback
          .filter(({ unique_id }) => unique_id)
          .map(({ unique_id }) => unique_id!.toString()),
      );

      const lateAdditionsCra = await this.airtableClient.getFeedback({
        start: lateAdditionsStart,
        end: lateAdditionsEnd,
      });

      const lateAdditionsLive = await this.airtableClient.getLiveFeedback({
        start: lateAdditionsStart,
        end: lateAdditionsEnd,
      });

      const lateAdditions = [...lateAdditionsCra, ...lateAdditionsLive]
        .filter(
          ({ unique_id }) =>
            unique_id && !existingIds.has(unique_id.toString()),
        )
        .map((feedback) => ({
          _id: new Types.ObjectId(),
          ...feedback,
        }));

      if (lateAdditions.length > 0) {
        this.logger.log(
          `Found ${lateAdditions.length} "late additions" for Feedback`,
        );
      }

      newFeedback.push(...lateAdditions);
    }

    const dateRange = {
      start,
      end,
    };

    // Promise.all() would be slower here because of rate-limiting
    const craFeedbackData = await this.airtableClient.getFeedback(dateRange);
    const liveFeedbackData =
      await this.airtableClient.getLiveFeedback(dateRange);

    const feedbackData = [...craFeedbackData, ...liveFeedbackData].map(
      (data) =>
        ({
          _id: new Types.ObjectId(),
          ...data,
        }) as IFeedback,
    );

    newFeedback.push(...feedbackData);

    if (newFeedback.length === 0) {
      this.logger.log('Feedback data already up-to-date.');
      return;
    }

    this.logger.log(`${newFeedback.length} total new Feedback records`);

    return await this.feedbackModel
      .insertMany(newFeedback)
      .then(() =>
        this.logger.log(
          `Successfully added ${newFeedback.length} Feedback data`,
        ),
      )
      .catch((err) => {
        this.logger.error('Error updating feedback data');
        this.logger.error(err);
      });
  }

  async repopulateFeedback() {
    this.logger.log(
      'Repopulating Feedback data... This may take several minutes.',
    );

    await this.feedbackModel.deleteMany({});

    await this.updateFeedbackData();

    this.logger.log('Finished repopulating Feedback data.');
  }
}
