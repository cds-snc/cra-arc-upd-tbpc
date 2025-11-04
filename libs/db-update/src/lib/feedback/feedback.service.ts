import type { AbstractDate, IFeedback } from '@dua-upd/types-common';
import { AsyncLogTiming } from '@dua-upd/utils-common';
import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { dayjs, today } from '@dua-upd/utils-common';
import { AirtableClient } from '@dua-upd/external-data';
import { Feedback } from '@dua-upd/db';
import type { FeedbackDocument } from '@dua-upd/db';
import { preprocessCommentWords } from '@dua-upd/feedback';

export type FeedbackApiRecord = {
  url: string;
  institution: string;
  theme: string;
  problemDetails: string;
  language: string;
  problemDate: string;
  timeStamp: string;
  deviceType: string;
  browser: string;
};

@Injectable()
export class FeedbackService {
  constructor(
    @Inject(AirtableClient.name) private airtableClient: AirtableClient,
    private logger: ConsoleLogger,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedbackModel: Model<FeedbackDocument>,
  ) {}

  async getFeedbackAuthToken() {
    try {
      return await fetch(`${process.env.FEEDBACK_API_HOST}/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: process.env.FEEDBACK_API_USERNAME,
          password: process.env.FEEDBACK_API_PASSWORD,
        }),
      }).then((res) => res.text());
    } catch (err) {
      this.logger.error('Error getting Feedback auth token');
      this.logger.error(err);
      throw err;
    }
  }

  @AsyncLogTiming
  async updateFeedbackData(endDate?: AbstractDate, useProcessedDate = true) {
    this.logger.log('Updating Feedback data');
    const latestDataDate: Date | undefined = (
      await this.feedbackModel.findOne({}, { date: 1 }).sort({ date: -1 })
    )?.date;

    if (latestDataDate) {
      this.logger.log(`Latest feedback date: ${latestDataDate.toISOString()}`);
    }

    const start = dayjs.utc(latestDataDate || '2020-01-01').add(1, 'day');

    const end = endDate || today().subtract(1, 'day');

    if (latestDataDate && dayjs.utc(latestDataDate).isSame(end)) {
      this.logger.log('Feedback data already up-to-date.');
      return;
    }

    const startDateProperty = useProcessedDate
      ? 'processedStartDate'
      : 'startDate';

    const endDateProperty = useProcessedDate ? 'processedEndDate' : 'endDate';

    const url = new URL(`${process.env.FEEDBACK_API_HOST}/api/problems`);

    const params = {
      [startDateProperty]: start.format('YYYY-MM-DD'),
      [endDateProperty]: dayjs.utc(end).format('YYYY-MM-DD'),
      url: '/en/revenue-agency|/fr/agence-revenu|/en/services/taxes|/fr/services/impots',
    };

    url.search = new URLSearchParams(params).toString();

    this.logger.log(
      `Fetching feedback data for date range: ${params[startDateProperty]} - ${params[endDateProperty]}`,
    );

    const headers = {
      Authorization: `Bearer ${await this.getFeedbackAuthToken()}`,
    };

    const results = await fetch(url, {
      headers,
    }).then(async (res) => res.json() as Promise<FeedbackApiRecord[]>);

    this.logger.log(`${results.length} total new Feedback records`);

    this.logger.log('Parsing feedback data...');

    const feedback: IFeedback[] = results.map(
      ({ problemDate, url, language, problemDetails, theme }) => ({
        _id: new Types.ObjectId(),
        date: new Date(problemDate),
        url: url.replace(/^https:\/\//, ''),
        lang: language.toUpperCase(),
        comment: problemDetails,
        theme,
      }),
    );

    const feedbackWithWords = preprocessCommentWords(feedback);

    return await this.feedbackModel
      .insertMany(feedbackWithWords)
      .then(() =>
        this.logger.log(`Successfully added ${feedback.length} Feedback data`),
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

    await this.updateFeedbackData(undefined, false);

    this.logger.log('Finished repopulating Feedback data.');
  }
}
