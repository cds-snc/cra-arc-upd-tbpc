import { type mongo, Types, type UpdateOneModel } from 'mongoose';
import { DbViewNew, type ViewConfig } from '../db.views.new';
import type { FeedbackView, FeedbackViewSchema } from './feedback-view.schema';
import type {
  DateRange,
  IFeedbackViewComment,
  IFeedbackViewWord,
} from '@dua-upd/types-common';
import {
  arrayToDictionary,
} from '@dua-upd/utils-common';
import { DbService } from '../db.service';
import { omit } from 'rambdax';

export type FeedbackViewConfig = ViewConfig<typeof FeedbackViewSchema>;

/**
 * The base document data that will be passed to the refresh method
 * to generate a single write operation for a view document.
 */
type BaseDoc = {
  refId: Types.ObjectId;
  refType: 'task' | 'project';
  dateRange: DateRange<Date>;
};

/**
 * The context object that will be passed to the refresh method
 * to be shared between all refresh operations.
 */
type RefreshContext = {
  pagesByUrl: Record<
    string,
    { url: string; owners?: string; sections?: string }
  >;
};

type RefreshWriteOp = {
  updateOne: UpdateOneModel<FeedbackView> & { upsert: true };
};

export type FeedbackViewQuery = {
  refId: Types.ObjectId;
  refType: 'task' | 'project';
  dateRange: DateRange<Date>;
  lang?: 'en' | 'fr';
  docType?: 'word' | 'comment';
};

export class FeedbackViewService extends DbViewNew<
  FeedbackView,
  typeof FeedbackViewSchema,
  BaseDoc,
  RefreshContext
> {
  protected refreshFilterProps = ['refId', 'refType', 'dateRange'];

  constructor(
    private db: DbService,
    config: FeedbackViewConfig,
  ) {
    super(config);
  }

  async prepareRefreshContext({ dateRange }: { dateRange: DateRange<Date> }) {
    console.log('preparing refresh');
    const [pagesByUrl, taskIds, projectIds] = await Promise.all([
      this.db.collections.pages
        .find({}, { _id: 0, url: 1, owners: 1, sections: 1 })
        .lean()
        .exec()
        .then((pages) =>
          arrayToDictionary<{
            url: string;
            owners?: string;
            sections?: string;
          }>(pages, 'url'),
        ),
      this.db.collections.tasks
        .distinct('_id', { 'pages.0': { $exists: true } })
        .exec() as Promise<Types.ObjectId[] | null>,
      this.db.collections.projects
        .distinct('_id', { 'pages.0': { $exists: true } })
        .exec() as Promise<Types.ObjectId[] | null>,
    ]);

    const taskBaseDocs: BaseDoc[] =
      taskIds?.map((id) => ({
        refId: id,
        refType: 'task',
        dateRange,
      })) || [];

    const projectBaseDocs: BaseDoc[] =
      projectIds?.map((id) => ({
        refId: id,
        refType: 'project',
        dateRange,
      })) || [];

    return {
      baseDocs: [...taskBaseDocs, ...projectBaseDocs] satisfies BaseDoc[],
      ctx: { pagesByUrl },
    };
  }

  async refresh(
    { dateRange, refId, refType }: BaseDoc,
    { pagesByUrl }: RefreshContext,
  ) {
    const mostRelevant =
      await this.db.collections.feedback.getMostRelevantCommentsAndWords({
        dateRange,
        type: refType,
        id: refId,
      });

    const words = [
      ...mostRelevant.en.words.map((word) => ({
        docType: 'word',
        refType,
        refId,
        dateRange,
        lang: 'en',
        ...word,
      })),
      ...mostRelevant.fr.words.map((word) => ({
        docType: 'word',
        refType,
        refId,
        dateRange,
        lang: 'fr',
        ...word,
      })),
    ];

    const comments = [
      ...mostRelevant.en.comments.map((comment) => ({
        docType: 'comment',
        refType,
        refId,
        dateRange,
        ...omit(['_id', 'tasks', 'projects'], comment),
        lang: 'en',
      })),
      ...mostRelevant.fr.comments.map((comment) => ({
        docType: 'comment',
        refType,
        refId,
        dateRange,
        ...omit(['_id', 'tasks', 'projects'], comment),
        lang: 'fr',
      })),
    ].map((comment) => ({
      ...comment,
      owners: pagesByUrl[comment.url]?.owners,
      sections: pagesByUrl[comment.url]?.sections,
    }));

    const docs = [...words, ...comments];

    const bulkWriteOps = docs.map(
      (doc) =>
        ({
          updateOne: {
            filter: {
              refId: doc.refId,
              refType: doc.refType,
              dateRange: doc.dateRange,
              lang: doc.lang,
              docType: doc.docType,
              ...(doc.docType === 'word'
                ? { word: doc['word'] }
                : { comment: doc['comment'] }),
            },
            update: {
              $setOnInsert: {
                _id: new Types.ObjectId(),
                refId: doc.refId,
                refType: doc.refType,
                dateRange: doc.dateRange,
                lang: doc.lang,
                docType: doc.docType,
              },
              $set: omit(
                ['refId', 'refType', 'dateRange', 'lang', 'docType'],
                doc,
              ),
            },
            upsert: true,
          },
        }) as RefreshWriteOp,
    );

    return bulkWriteOps;
  }

  // You basically shouldn't use these for this view
  override find(): never {
    throw new Error('Mongoose methods should not be used for this view');
  }

  override findOne(): never {
    throw new Error('Mongoose methods should not be used for this view');
  }

  async getMostRelevantCommentsAndWords(
    dateRange: DateRange<Date>,
    type: 'task' | 'project',
    id: Types.ObjectId,
  ) {
    const mostRelevant = await this.aggregate<{
      docType: 'word' | 'comment';
      lang: 'en' | 'fr';
      data: Omit<
        IFeedbackViewWord | IFeedbackViewComment,
        '_id' | 'refId' | 'refType' | 'dateRange'
      >[];
    }>({
      dateRange,
      refType: type,
      refId: id,
    })
      .project({
        _id: 0,
        dateRange: 0,
        refType: 0,
        refId: 0,
      })
      .group({
        _id: {
          docType: '$docType',
          lang: '$lang',
        },
        data: {
          $push: {
            // Word fields
            word: '$word',
            word_occurrences: '$word_occurrences',
            comment_occurrences: '$comment_occurrences',
            term_frequency: '$term_frequency',
            comment_frequency: '$comment_frequency',
            inverse_doc_frequency: '$inverse_doc_frequency',
            // Comment fields
            date: '$date',
            url: '$url',
            rank: '$rank',
            comment: '$comment',
            commentScore: '$commentScore',
            owners: '$owners',
            sections: '$sections',
          },
        },
      })
      .project({
        _id: 0,
        docType: '$_id.docType',
        lang: '$_id.lang',
        data: 1,
      })
      .exec();

    return {
      en: {
        comments: mostRelevant
          .find((r) => r.docType === 'comment' && r.lang === 'en')
          ?.data.sort((a: IFeedbackViewComment, b: IFeedbackViewComment) =>
            a.rank ? a.rank - (b.rank || 0) : 1,
          ),
        words: mostRelevant
          .find((r) => r.docType === 'word' && r.lang === 'en')
          ?.data.sort((a: IFeedbackViewWord, b: IFeedbackViewWord) =>
            a.word_occurrences
              ? (b.word_occurrences || 0) - a.word_occurrences
              : 1,
          ),
      },
      fr: {
        comments: mostRelevant
          .find((r) => r.docType === 'comment' && r.lang === 'fr')
          ?.data.sort((a: IFeedbackViewComment, b: IFeedbackViewComment) =>
            a.rank ? a.rank - (b.rank || 0) : 1,
          ),
        words: mostRelevant
          .find((r) => r.docType === 'word' && r.lang === 'fr')
          ?.data.sort((a: IFeedbackViewWord, b: IFeedbackViewWord) =>
            a.word_occurrences
              ? (b.word_occurrences || 0) - a.word_occurrences
              : 1,
          ),
      },
    };
  }

  async clearNonExisting(): Promise<mongo.DeleteResult | null> {
    return null;
  }
}
