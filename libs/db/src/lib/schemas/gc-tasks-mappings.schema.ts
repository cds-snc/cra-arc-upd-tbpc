import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { model, Document, Schema as MSchema, Types } from 'mongoose';
import { IGCTasksMappings } from '@dua-upd/types-common';
import { Task } from './task.schema';

export type GCTasksMappingsDocument = GCTasksMappings & Document;

@Schema({ collection: 'gc_tasks_mappings' })
export class GCTasksMappings implements IGCTasksMappings {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: String, required: true, unique: true, index: true })
  airtable_id: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  title_fr: string;

  @Prop({ type: [{ type: MSchema.Types.ObjectId, ref: 'Task' }], index: true })
  tasks?: Types.ObjectId[] | Task[];

  @Prop({ type: Date })
  date_mapped?: Date;
}

export const GCTasksMappingsSchema = SchemaFactory.createForClass(GCTasksMappings);

export const GCTasksMappingsModel = model(GCTasksMappings.name, GCTasksMappingsSchema);

export function getGCTasksMappingsModel() {
  return GCTasksMappingsModel;
}