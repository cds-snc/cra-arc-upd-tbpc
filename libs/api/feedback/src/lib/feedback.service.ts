import { Injectable } from '@nestjs/common';
// need mongo import or TS will complain about missing types
import { Types, type FilterQuery } from 'mongoose';
import { omit } from 'rambdax';
import { DbService, Feedback } from '@dua-upd/db';
import { $trunc, arrayToDictionary } from '@dua-upd/utils-common';
import type {
  DateRange,
  FeedbackBase,
  FeedbackWithScores,
} from '@dua-upd/types-common';
import { FeedbackCache } from './feedback.cache';
import type {
  IFeedback,
  MostRelevantCommentsAndWords,
  MostRelevantCommentsAndWordsByLang,
  WordRelevance,
} from '@dua-upd/types-common';

export type FeedbackParams = {
  dateRange: DateRange<Date>;
  type?: 'page' | 'task' | 'project';
  id?: string;
  b?: number;
  k1?: number;
  ipd?: boolean;
};

export type RelevanceScoreParams = FeedbackParams & {
  lang: 'EN' | 'FR';
};

@Injectable()
export class FeedbackService {
  constructor(
    private db: DbService,
    private cache: FeedbackCache,
  ) {}

  // with percent change
  async getNumCommentsByPage(
    dateRange: string,
    comparisonDateRange: string,
    idFilter?: { tasks: Types.ObjectId } | { projects: Types.ObjectId },
  ) {
    const numCommentsByPage =
      await this.db.collections.feedback.getCommentsByPageWithComparison(
        dateRange,
        comparisonDateRange,
        idFilter,
      );

    const defaultValues = {
      sum: 0,
      percentChange: null,
    };

    // for overview, don't merge all pages with 0 comments
    const defaultsConfig = idFilter ? { defaultValues } : { noDefaults: true };

    return this.db.collections.pages.mergePages(numCommentsByPage, {
      dataJoinProp: 'url',
      pagesJoinProp: 'url',
      filter: idFilter,
      ...defaultsConfig,
      projection: {
        airtable_id: 0,
        altLangHref: 0,
        lastChecked: 0,
        lastModified: 0,
        metadata: 0,
      },
    });
  }

  async calculateRelevanceScores(
    params: RelevanceScoreParams,
  ): Promise<MostRelevantCommentsAndWords> {
    const filterQuery = paramsToQuery(params);

    const wordsFilterQuery = {
      ...filterQuery,
      words: { $exists: true },
    };

    const projection = Object.fromEntries([
      ...Object.keys(wordsFilterQuery).map((key) => [key, 1]),
    ]);

    if (params.ipd) {
      projection.url = 1;
    }

    const wordResultsAggregation = this.db.collections.feedback
      .aggregate<{ avgWords: number; totalWords: number }>()
      .project(projection)
      .match(wordsFilterQuery);

    const wordResultsIntermediate = params.ipd
      ? wordResultsAggregation
          .lookup({
            from: 'pages',
            localField: 'url',
            foreignField: 'url',
            as: 'page',
          })
          .unwind('$page')
          .match({ 'page.owners': /ipd/i })
      : wordResultsAggregation;

    const wordsResults = await wordResultsIntermediate
      .group({
        _id: null,
        avgWords: { $avg: { $size: '$words' } },
        totalWords: { $sum: { $size: '$words' } },
      })
      .addFields({
        avgWords: $trunc('$avgWords', 5),
      })
      .exec();

    if (!wordsResults?.length) {
      return {
        comments: [],
        words: [],
      };
    }

    const { avgWords, totalWords } = wordsResults[0];

    const wordScores = await this.calculateWordScores(
      filterQuery,
      totalWords,
      params.ipd,
    );

    const wordScoresMap = arrayToDictionary(wordScores, 'word');

    const commentsAggregation = this.db.collections.feedback
      .aggregate<FeedbackBase>()
      .project({ tags: 0, __v: 0, airtable_id: 0, unique_id: 0 })
      .match(filterQuery)
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
      });

    const comments = await (
      params.ipd
        ? commentsAggregation
            .match({ 'page.owners': /ipd/i })
            .project({ page: 0 })
        : commentsAggregation
    ).exec();

    const calculateBM25 = (words: string[]) => {
      const k1 = params.k1 || 2;
      const b = params.b || 0.5;

      // if we're only calculating scores for a single page, the page score is redundant
      // const includePageScore = params.type !== 'page';

      let commentScore = 0;
      // let pageScore = 0;

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

        // if (includePageScore) {
        //   pageScore += bm25 * scores.inverse_page_frequency;
        // }
      }

      // if (includePageScore) {
      //   return { commentScore, pageScore };
      // }

      return { commentScore };
    };

    const commentsWithScores: FeedbackWithScores[] = comments.map((comment) => {
      if (!comment.words?.length) {
        return comment;
      }

      const scores = calculateBM25(comment.words);

      return {
        ...omit(['words'], comment),
        ...scores,
      };
    });

    commentsWithScores.sort((a, b) =>
      a.commentScore ? (b.commentScore || 0) - a.commentScore : 1,
    );

    return {
      comments: commentsWithScores.map((comment, i) => ({
        ...comment,
        rank: comment.commentScore ? i + 1 : undefined,
      })),
      words: wordScores,
    };
  }

  async calculateWordScores(
    filterQuery: FilterQuery<Feedback>,
    totalWords: number,
    ipd?: boolean,
  ) {
    const ipdAggregationBase = this.db.collections.feedback
      .aggregate<{ count: number }>()
      .match(filterQuery)
      .project({ url: 1 })
      .lookup({
        from: 'pages',
        localField: 'url',
        foreignField: 'url',
        as: 'page',
      })
      .unwind('$page')
      .match({ 'page.owners': /ipd/i });

    const totalComments = ipd
      ? (
          await this.db.collections.feedback
            .aggregate(ipdAggregationBase.pipeline())
            .count('count')
            .exec()
        )?.[0].count || 0
      : await this.db.collections.feedback.countDocuments(filterQuery);

    // const totalPages = ipd
    //   ? (
    //       await ipdAggregationBase.group({ _id: '$url' }).count('count').exec()
    //     )?.[0].count
    //   : (await this.db.collections.feedback.distinct('url', filterQuery))
    //       .length;

    const wordsFilterQuery = {
      ...filterQuery,
      words: { $exists: true },
    };

    const projection = Object.fromEntries([
      ...Object.keys(filterQuery).map((key) => [key, 1]),
      ['url', 1],
      ['words', 1],
    ]);

    // const ifPage = <T extends object>(obj: T) => (filterQuery.page ? {} : obj);

    const aggregationBase = this.db.collections.feedback
      .aggregate<WordRelevance>()
      .project(projection)
      .match(wordsFilterQuery);

    const aggregationIntermediate = ipd
      ? aggregationBase
          .lookup({
            from: 'pages',
            localField: 'url',
            foreignField: 'url',
            as: 'page',
          })
          .unwind('$page')
          .match({ 'page.owners': /ipd/i })
      : aggregationBase;

    // todo: caching/output to view?
    return await aggregationIntermediate
      .unwind('words')
      .group({
        _id: '$words',
        word_occurrences: { $sum: 1 },
        comment_occurrences: {
          $addToSet: '$_id',
        },
        // ...ifPage({
        //   page_occurrences: {
        //     $addToSet: '$url',
        //   },
        // }),
      })
      .addFields({
        comment_occurrences: { $size: '$comment_occurrences' },
        // ...ifPage({
        //   page_occurrences: { $size: '$page_occurrences' },
        // }),
      })
      .match({
        comment_occurrences: { $gt: 1 },
      })
      .addFields({
        // which term frequency calculation?
        // term_frequency: {
        //   $round: [
        //     {
        //       $divide: ['$word_occurrences', totalWords],
        //     },
        //     7,
        //   ],
        // },
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
        // ...ifPage({
        //   page_frequency: {
        //     $round: [
        //       {
        //         $divide: ['$page_occurrences', totalPages],
        //       },
        //       5,
        //     ],
        //   },
        // }),
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
        // inverse_doc_frequency: {
        //   $round: [
        //     {
        //       $ln: {
        //         $divide: [
        //           {
        //             $sum: [
        //               // change to "(totalComments + 1) / (comment_occurrences + 0.5)"?
        //               1,
        //               totalComments,
        //               // { $sum: [0.5, '$comment_occurrences'] },
        //             ],
        //           },
        //           { $sum: [0.5, '$comment_occurrences'] },
        //         ],
        //       },
        //     },
        //     4,
        //   ],
        // },

        // --------------------------- EXPERIMENTAL IDF CALCULATION!

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
        // ----------- not using page score for now
        // ...ifPage({
        //   // --------------------------- could potentially use "EXPERIMENTAL CALCULATION" here too
        //   inverse_page_frequency: {
        //     $round: [
        //       {
        //         $ln: {
        //           $sum: [
        //             0,
        //             {
        //               $divide: [
        //                 {
        //                   $sum: [
        //                     1,
        //                     totalPages,
        //                     // { $sum: [0.5, '$page_occurrences'] },
        //                   ],
        //                 },
        //                 { $sum: [0.5, '$page_occurrences'] },
        //               ],
        //             },
        //           ],
        //         },
        //       },
        //       4,
        //     ],
        //   },
        // }),
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

  async getComments(params: FeedbackParams) {
    const cachedComments = await this.cache.get<IFeedback[]>('comments', {
      dateRange: params.dateRange,
      type: params.type,
      id: params.id,
    });

    if (cachedComments) {
      return cachedComments;
    }

    console.time(
      `Fetching comments ${params.type || ''}${params.id || ''} from db`,
    );

    const comments = await this.db.collections.feedback
      .find(paramsToQuery(params), { airtable_id: 0, unique_id: 0, __v: 0 })
      .lean()
      .exec();

    console.timeEnd(
      `Fetching comments ${params.type || ''}${params.id || ''} from db`,
    );

    // don't cache overview
    if (params.type) {
      await this.cache.set('comments', params, comments);
    }

    return comments;
  }

  async getMostRelevantCommentsAndWords(params: FeedbackParams) {
    const startTime = Date.now();

    const mostRelevant: MostRelevantCommentsAndWordsByLang = {
      en: await this.calculateRelevanceScores({
        ...params,
        lang: 'EN',
      }),
      fr: await this.calculateRelevanceScores({
        ...params,
        lang: 'FR',
      }),
    };

    const endTime = Date.now();

    console.log(`Comment relevance: ${endTime - startTime}ms`);

    return mostRelevant;
  }
}

function paramsToQuery(params: FeedbackParams | RelevanceScoreParams) {
  const query: FilterQuery<Feedback> = {
    date: {
      $gte: params.dateRange.start,
      $lte: params.dateRange.end,
    },
    lang: 'lang' in params ? params.lang : 'EN',
  };

  if (params.id && !params.type) {
    throw new Error(
      'Type is required when id is provided. Received id: ' + params.id,
    );
  }

  if (!params.type) {
    return query;
  }

  if (!params.id) {
    throw new Error(
      'Id is required when type is provided. Received type: ' + params.type,
    );
  }

  if (params.type === 'page') {
    query.page = new Types.ObjectId(params.id);

    return query;
  }

  query[`${params.type}s`] = new Types.ObjectId(params.id);

  return query;
}
