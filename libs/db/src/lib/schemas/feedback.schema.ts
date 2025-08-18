import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type {
  AnyBulkWriteOperation,
  Document,
  FilterQuery,
  Model,
} from 'mongoose';
import { Types } from 'mongoose';
import type {
  DateRange,
  FeedbackBase,
  FeedbackWithScores,
  IFeedback,
  IPage,
  MostRelevantCommentsAndWordsByLang,
  WordRelevance,
} from '@dua-upd/types-common';
import {
  type ModelWithStatics,
  arrayToDictionary,
  dateRangeSplit,
  percentChange,
  datesFromDateRange,
  $trunc,
} from '@dua-upd/utils-common';
import { omit } from 'rambdax';
import { batchWrite } from '../utils';

export type FeedbackDocument = Feedback & Document;

@Schema({ collection: 'feedback' })
export class Feedback implements IFeedback {
  @Prop({ type: Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: String })
  airtable_id? = '';

  @Prop({ type: Types.ObjectId, index: true })
  unique_id?: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  url = '';

  @Prop({ type: Date, required: true, index: true })
  date: Date = new Date(0);

  @Prop({ type: String })
  lang = '';

  @Prop({ type: String })
  comment = '';

  @Prop({ type: [String], default: undefined })
  words?: string[];

  @Prop({ type: [String], default: undefined })
  tags?: string[];

  @Prop({ type: String })
  status?: string;

  @Prop({ type: String })
  whats_wrong?: string;

  @Prop({ type: String })
  main_section?: string;

  @Prop({ type: String })
  theme?: string;

  @Prop({ type: Types.ObjectId, index: true })
  page?: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], index: true, default: undefined })
  tasks?: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], index: true, default: undefined })
  projects?: Types.ObjectId[];

  static async syncReferences(
    this: Model<Feedback>,
    pages: Pick<IPage, '_id' | 'url' | 'tasks' | 'projects'>[],
  ): Promise<number> {
    const bulkWriteOps = pages.map((page) => ({
      updateMany: {
        filter: { url: page.url },
        update: {
          $set: {
            page: page._id,
            tasks: page.tasks as Types.ObjectId[],
            projects: page.projects as Types.ObjectId[],
          },
        },
      },
    })) satisfies AnyBulkWriteOperation<IFeedback>[];

    if (bulkWriteOps.length) {
      return batchWrite(this, bulkWriteOps, { batchSize: 10, ordered: false });
    }

    return 0;
  }

  static async getComments(
    this: Model<Feedback>,
    dateRange: string,
    urls: string[],
  ) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    return (
      (await this.find({
        url: { $in: urls },
        date: { $gte: startDate, $lte: endDate },
      }).exec()) || []
    ).map((feedback: Feedback) => ({
      date: feedback.date,
      url: feedback.url,
      tag: feedback.tags?.length ? feedback.tags[0] : '',
      whats_wrong: feedback.whats_wrong || '',
      comment: feedback.comment,
    }));
  }

  static async getCommentsByTag(
    this: Model<Feedback>,
    dateRange: string,
    urls: string[],
  ) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    return this.aggregate<{ tag: string; numComments: number }>()
      .match({
        url: { $in: urls },
        date: { $gte: startDate, $lte: endDate },
      })
      .unwind({ path: '$tags', preserveNullAndEmptyArrays: true })
      .group({
        _id: '$tags',
        numComments: { $sum: 1 },
      })
      .project({
        _id: 0,
        tag: {
          $ifNull: ['$_id', 'n/a'],
        },
        numComments: 1,
      })
      .exec();
  }

  static async getCommentsByPage(
    this: Model<Feedback>,
    dateRange: string,
    idFilter?: { tasks: Types.ObjectId } | { projects: Types.ObjectId },
  ) {
    const [startDate, endDate] = dateRangeSplit(dateRange);

    const projection = idFilter
      ? Object.fromEntries(Object.keys(idFilter).map((key) => [key, 1]))
      : {};

    const matchFilter: FilterQuery<Feedback> = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      ...(idFilter || {}),
    };

    const results = await this.aggregate<{
      url: string;
      sum: number;
    }>()
      .project({
        date: 1,
        url: 1,
        ...projection,
      })
      .match(matchFilter)
      .group({
        _id: '$url',
        sum: { $sum: 1 },
      })
      .project({
        _id: 0,
        url: '$_id',
        sum: 1,
      })
      .exec();

    return results;
  }

  static async getCommentsByPageWithComparison(
    this: FeedbackModel,
    dateRange: string,
    comparisonDateRange: string,
    idFilter?: { tasks: Types.ObjectId } | { projects: Types.ObjectId },
  ): Promise<
    {
      percentChange: number | null;
      url: string;
      sum: number;
    }[]
  > {
    const [commentsByPage, comparisonCommentsByPage] = await Promise.all([
      this.getCommentsByPage(dateRange, idFilter),
      this.getCommentsByPage(comparisonDateRange, idFilter),
    ]);

    const comparisonCommentsDict = arrayToDictionary(
      comparisonCommentsByPage,
      'url',
    );

    return commentsByPage.map((page) => {
      const numPreviousComments = comparisonCommentsDict[page.url]?.sum;

      return {
        ...page,
        percentChange: numPreviousComments
          ? percentChange(page.sum, numPreviousComments)
          : null,
      };
    });
  }

  static async getCommentsByDay(
    this: FeedbackModel,
    dateRange: string | DateRange<Date>,
    idFilter?:
      | { page: Types.ObjectId }
      | { tasks: Types.ObjectId }
      | { projects: Types.ObjectId },
  ) {
    const [startDate, endDate] =
      typeof dateRange === 'string'
        ? dateRangeSplit(dateRange)
        : [dateRange.start, dateRange.end];

    const projection = idFilter
      ? Object.fromEntries(Object.keys(idFilter).map((key) => [key, 1]))
      : {};

    const matchFilter: FilterQuery<Feedback> = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      ...(idFilter || {}),
    };

    const results = await this.aggregate<{ date: Date; sum: number }>()
      .match(matchFilter)
      .project({
        date: 1,
        url: 1,
        ...projection,
      })
      .group({
        _id: '$date',
        sum: { $sum: 1 },
      })
      .project({
        _id: 0,
        date: '$_id',
        sum: 1,
      })
      .exec();

    const dateDict = arrayToDictionary(results, 'date');

    const dates = datesFromDateRange(dateRange, false, true) as Date[];

    return dates.map((date) => ({
      date,
      sum: dateDict[date.toString()]?.sum || 0,
    }));
  }

  static async calculateWordScores(
    this: FeedbackModel,
    filterQuery: FilterQuery<Feedback>,
    totalWords: number,
  ) {
    const totalComments = await this.countDocuments(filterQuery);

    const wordsFilterQuery = {
      ...filterQuery,
      words: { $exists: true },
    };

    const projection = Object.fromEntries([
      ...Object.keys(filterQuery).map((key) => [key, 1]),
      ['url', 1],
      ['words', 1],
    ]);

    return this.aggregate<WordRelevance>()
      .project(projection)
      .match(wordsFilterQuery)
      .unwind('words')
      .group({
        _id: '$words',
        word_occurrences: { $sum: 1 },
        comment_occurrences: {
          $addToSet: '$_id',
        },
      })
      .addFields({
        comment_occurrences: { $size: '$comment_occurrences' },
      })
      .match({
        comment_occurrences: { $gt: 1 },
      })
      .addFields({
        term_frequency: $trunc(
          {
            $ln: {
              $sum: [
                1,
                {
                  $divide: ['$word_occurrences', totalWords],
                },
              ],
            },
          },
          8,
        ),
      })
      .addFields({
        comment_frequency: $trunc(
          {
            $divide: ['$comment_occurrences', totalComments],
          },
          7,
        ),
      })
      .match({
        term_frequency: { $gt: 0.000001 },
      })
      .addFields({
        inverse_doc_frequency: $trunc(
          {
            $multiply: [
              Math.E,
              {
                $ln: {
                  $sum: [
                    1,
                    {
                      $divide: [
                        {
                          $sum: [
                            {
                              $subtract: [
                                totalComments,
                                '$comment_occurrences',
                              ],
                            },
                            {
                              $sqrt: totalComments,
                            },
                          ],
                        },
                        {
                          $sum: [
                            '$comment_occurrences',
                            {
                              $sqrt: totalComments,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
          5,
        ),
      })
      .match({
        term_frequency: { $gte: 0.00001 },
      })
      .sort({
        term_frequency: -1,
      })
      .addFields({
        word: '$_id',
      })
      .project({
        _id: 0,
      })
      .exec();
  }

  static async calculateRelevanceScores(
    this: FeedbackModel,
    params: {
      dateRange: DateRange<Date>;
      type?: 'page' | 'task' | 'project';
      id?: string;
      lang: 'EN' | 'FR';
    },
  ) {
    const idFilter =
      params.type && params.id
        ? {
            [params.type === 'page' ? params.type : `${params.type}s`]:
              new Types.ObjectId(params.id),
          }
        : {};

    const query: FilterQuery<Feedback> = {
      date: {
        $gte: params.dateRange.start,
        $lte: params.dateRange.end,
      },
      lang: 'lang' in params ? params.lang : 'EN',
      ...idFilter,
    };

    const wordsQuery = {
      ...query,
      words: { $exists: true },
    };

    const projection = Object.fromEntries([
      ...Object.keys(wordsQuery).map((key) => [key, 1]),
    ]);

    const wordResults = await this.aggregate<{
      avgWords: number;
      totalWords: number;
    }>()
      .project(projection)
      .match(wordsQuery)
      .group({
        _id: null,
        avgWords: { $avg: { $size: '$words' } },
        totalWords: { $sum: { $size: '$words' } },
      })
      .addFields({
        avgWords: $trunc('$avgWords', 5),
      })
      .exec();

    if (!wordResults?.length) {
      return {
        comments: [],
        words: [],
      };
    }

    const { avgWords, totalWords } = wordResults[0];

    const wordScores = await this.calculateWordScores(query, totalWords);

    const wordScoresMap = arrayToDictionary(wordScores, 'word');

    const comments = await this.aggregate<FeedbackBase>()
      .project({ tags: 0, __v: 0, airtable_id: 0, unique_id: 0 })
      .match(query)
      .lookup({
        from: 'pages',
        localField: 'url',
        foreignField: 'url',
        as: 'page',
      })
      .unwind('$page')
      .addFields({
        sections: '$page.sections',
        tasks: '$page.tasks',
        owners: '$page.owners',
      })
      .lookup({
        from: 'tasks',
        localField: 'tasks',
        foreignField: '_id',
        as: 'tasks',
      })
      .addFields({
        tasks: {
          $map: { input: '$tasks', as: 'task', in: '$$task.title' },
        },
      })
      .project({ page: 0 })
      .exec();

    const calculateBM25 = (words: string[]) => {
      const k1 = 2;
      const b = 0.5;

      let commentScore = 0;

      for (const word of words) {
        const scores = wordScoresMap[word];

        if (!scores) {
          continue;
        }

        const tf = scores.term_frequency;
        const idf = scores.inverse_doc_frequency;

        // `b` being the normalization factor
        const commentLengthNormalization =
          1 - b + b * (words.length / avgWords);

        // multiply idf by smoothed term frequency, normalized by comment length
        const bm25 =
          idf * ((tf * (k1 + 1)) / (tf + k1 * commentLengthNormalization));

        commentScore += bm25;
      }

      return { commentScore };
    };

    const commentsWithScores = comments
      .map(
        (comment) =>
          (!comment.words?.length
            ? comment
            : {
                ...omit(['words'], comment),
                ...calculateBM25(comment.words),
              }) as FeedbackWithScores,
      )
      .sort((a, b) =>
        a.commentScore ? (b.commentScore || 0) - a.commentScore : 1,
      )
      .map((comment, i) => ({
        ...comment,
        rank: comment.commentScore ? i + 1 : undefined,
      }));

    return {
      comments: commentsWithScores,
      words: wordScores,
    };
  }

  static async getMostRelevantCommentsAndWords(
    this: FeedbackModel,
    params: {
      dateRange: DateRange<Date>;
      type?: 'page' | 'task' | 'project';
      id?: string | Types.ObjectId;
    },
  ): Promise<MostRelevantCommentsAndWordsByLang> {
    const id = params.id?.toString();
    return {
      en: await this.calculateRelevanceScores({
        ...params,
        id,
        lang: 'EN',
      }),
      fr: await this.calculateRelevanceScores({
        ...params,
        id,
        lang: 'FR',
      }),
    };
  }
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

FeedbackSchema.index({ url: 1, date: 1 });
FeedbackSchema.index(
  { date: 1, words: 1 },
  { partialFilterExpression: { words: { $exists: true } } },
);
FeedbackSchema.index(
  { date: 1, page: 1 },
  { partialFilterExpression: { page: { $exists: true } } },
);
FeedbackSchema.index(
  { date: 1, tasks: 1 },
  { partialFilterExpression: { tasks: { $exists: true } } },
);
FeedbackSchema.index(
  { date: 1, projects: 1 },
  { partialFilterExpression: { projects: { $exists: true } } },
);

const statics = {
  syncReferences: Feedback.syncReferences,
  getComments: Feedback.getComments,
  getCommentsByTag: Feedback.getCommentsByTag,
  getCommentsByPage: Feedback.getCommentsByPage,
  getCommentsByPageWithComparison: Feedback.getCommentsByPageWithComparison,
  getCommentsByDay: Feedback.getCommentsByDay,
  calculateWordScores: Feedback.calculateWordScores,
  calculateRelevanceScores: Feedback.calculateRelevanceScores,
  getMostRelevantCommentsAndWords: Feedback.getMostRelevantCommentsAndWords,
};

FeedbackSchema.statics = statics;

export type FeedbackModel = ModelWithStatics<Feedback, typeof statics>;
