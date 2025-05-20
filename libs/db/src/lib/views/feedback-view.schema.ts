import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type {
  DateRange,
  IFeedbackView,
  IFeedbackViewComment,
  IFeedbackViewWord,
} from '@dua-upd/types-common';

@Schema({
  collection: 'view_feedback',
  discriminatorKey: 'docType',
  strict: false,
})
export class FeedbackView implements IFeedbackView {
  @Prop({ type: Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: String, required: true, enum: ['word', 'comment'] })
  docType: 'word' | 'comment';

  @Prop({ type: String, required: true, enum: ['task', 'project'] })
  refType: 'task' | 'project';

  @Prop({ type: Types.ObjectId, required: true })
  refId: Types.ObjectId;

  @Prop({
    required: true,
    type: { start: Date, end: Date },
    index: true,
    _id: false,
  })
  dateRange: DateRange<Date>;

  @Prop({ type: String, required: true, enum: ['en', 'fr'] })
  lang: 'en' | 'fr';

  @Prop({ type: Date, default: () => new Date(), index: true })
  lastUpdated: Date;
}

export const FeedbackViewSchema = SchemaFactory.createForClass(FeedbackView);

FeedbackViewSchema.index({ refId: 1, refType: 1, dateRange: 1 });
FeedbackViewSchema.index({ refId: 1, refType: 1, dateRange: 1, lang: 1 });
FeedbackViewSchema.index({ docType: 1, refId: 1, dateRange: 1, lang: 1 });

@Schema()
export class FeedbackViewWord implements IFeedbackViewWord {
  _id: Types.ObjectId;
  docType: 'word';
  refType: 'task' | 'project';
  refId: Types.ObjectId;
  dateRange: DateRange<Date>;
  lang: 'en' | 'fr';
  lastUpdated: Date;

  @Prop({ type: String, required: true })
  word: string;

  @Prop({ type: Number, required: true })
  word_occurrences: number;

  @Prop({ type: Number, required: true })
  comment_occurrences: number;

  @Prop({ type: Number, required: true })
  term_frequency: number;

  @Prop({ type: Number, required: true })
  comment_frequency: number;

  @Prop({ type: Number, required: true })
  inverse_doc_frequency: number;
}

export const FeedbackViewWordSchema =
  SchemaFactory.createForClass(FeedbackViewWord);

FeedbackViewWordSchema.index({
  dateRange: 1,
  docType: 1,
  refType: 1,
  word_occurrences: -1,
});

@Schema()
export class FeedbackViewComment implements IFeedbackViewComment {
  _id: Types.ObjectId;
  docType: 'comment';
  refType: 'task' | 'project';
  refId: Types.ObjectId;
  dateRange: DateRange<Date>;
  lang: 'en' | 'fr';
  lastUpdated: Date;

  @Prop({ type: String, required: true })
  url: string;

  @Prop({ type: Number })
  rank?: number;

  @Prop({ type: Number })
  commentScore?: number;

  /**
   * Date of the comment
   * (not to be confused with the dateRange of the view)
   */
  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: String, required: true })
  comment: string;

  @Prop({ type: String })
  owners?: string;

  @Prop({ type: String })
  sections?: string;
}

export const FeedbackViewCommentSchema =
  SchemaFactory.createForClass(FeedbackViewComment);

FeedbackViewCommentSchema.index({
  dateRange: 1,
  docType: 1,
  refType: 1,
  rank: 1,
});

export const FeedbackViewRegistration = {
  name: FeedbackView.name,
  schema: FeedbackViewSchema,
  discriminators: [
    {
      name: FeedbackViewWord.name,
      schema: FeedbackViewWordSchema,
      value: 'word',
    },
    {
      name: FeedbackViewComment.name,
      schema: FeedbackViewCommentSchema,
      value: 'comment',
    },
  ],
};
