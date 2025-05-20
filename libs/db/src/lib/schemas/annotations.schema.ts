import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { model, Document, Schema as MSchema, Types } from 'mongoose';
import { IAnnotations } from '@dua-upd/types-common';
import type {
  AnnotationsAudienceType,
  AnnotationsDataAffectedType,
  AnnotationsEventType,
} from '@dua-upd/types-common';
import { Task } from './task.schema';

export type AnnotationsDocument = Annotations & Document;

@Schema()
export class Annotations implements IAnnotations {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: String, required: true, unique: true, index: true })
  airtable_id: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  title_fr: string;

  @Prop({ type: String, required: true, index: true })
  event_type: AnnotationsEventType;

  @Prop({ type: String })
  description? = '';

  @Prop({ type: String })
  description_fr? = '';

  @Prop({ type: Date, required: true, index: true })
  event_date: Date;

  @Prop({ type: [String] })
  data_affected?: AnnotationsDataAffectedType[] = [];

  @Prop({ type: [{ type: MSchema.Types.ObjectId, ref: 'Task' }] })
  tasks_affected?: Types.ObjectId[] | Task[];

  @Prop({ type: [String] })
  audience?: AnnotationsAudienceType[] = [];

  @Prop({ type: Date })
  date_entered?: Date;

  @Prop({ type: String })
  notes? = '';

  @Prop({ type: String })
  notes_fr? = '';

  @Prop({ type: String })
  predictive_insight? = '';

  @Prop({ type: String })
  predictive_insight_fr? = '';
}

export const AnnotationsSchema = SchemaFactory.createForClass(Annotations);

export const annotationsModel = model(Annotations.name, AnnotationsSchema);

export function getAnnotationsModel() {
  return annotationsModel;
}
