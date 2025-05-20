import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { model, Document, Model, Schema as MSchema, Types } from 'mongoose';
import type { IReadability } from '@dua-upd/types-common';

export type ReadabilityDocument = Readability & Document;

@Schema({ collection: 'readability' })
export class Readability implements IReadability {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: MSchema.Types.ObjectId, required: true, index: true })
  page: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  url: string;

  @Prop({ type: String, required: true, index: true })
  lang: 'en' | 'fr';

  @Prop({ type: String, required: true, index: true })
  hash: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: Number, required: true, index: true })
  original_score: number;

  @Prop({ type: Number, required: true, index: true })
  final_fk_score: number;

  @Prop({ type: Number, required: true })
  fk_points: number;

  @Prop({ type: Number, required: true })
  avg_words_per_paragraph: number;

  @Prop({ type: Number, required: true })
  avg_words_per_header: number;

  @Prop({ type: Number, required: true })
  paragraph_points: number;

  @Prop({ type: Number, required: true })
  header_points: number;

  @Prop({
    type: [{ word: String, count: Number }],
    _id: false,
  })
  word_counts: { word: string; count: number }[];

  @Prop({ type: Number, required: true })
  total_sentences: number;

  @Prop({ type: Number, required: true })
  total_syllables: number;

  @Prop({ type: Number, required: true })
  total_paragraph: number;

  @Prop({ type: Number, required: true })
  total_headings: number;

  @Prop({ type: Number, required: true })
  total_words: number;

  @Prop({ type: Number, required: true, index: true })
  total_score: number;
}

export const ReadabilitySchema = SchemaFactory.createForClass(Readability);

ReadabilitySchema.index({ url: 1, date: 1 }, { unique: true });
ReadabilitySchema.index({ page: 1, date: 1 });
ReadabilitySchema.index({ url: 1, page: 1 });
ReadabilitySchema.index({ url: 1, hash: 1 });
ReadabilitySchema.index({ date: -1 });

export function getReadabilityModel() {
  return model(Readability.name, ReadabilitySchema);
}

ReadabilitySchema.statics['getReadability'] = async function (
  url: string,
  dateRange: string
) {
  const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

  return this.aggregate<IReadability>()
    .sort({ url: 1, date: 1 })
    .match({ url, date: { $gte: startDate, $lte: endDate } })
    .exec();
};

export interface ReadabilityModel extends Model<ReadabilityDocument> {
  getReadability(dateRange: string, language: string): Promise<IReadability[]>;
}
