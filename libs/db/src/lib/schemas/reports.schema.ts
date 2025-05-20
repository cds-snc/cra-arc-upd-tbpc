import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, model, Schema as MSchema, Types } from 'mongoose';

import type { AttachmentData } from '@dua-upd/types-common';

export type ReportsDocument = Reports & Document;

@Schema({
  collection: 'reports',
  timestamps: true,
  toObject: { getters: true },
})
export class Reports {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: String })
  airtable_id?: string;

  @Prop({ type: String })
  en_title?: string;

  @Prop({ type: String })
  fr_title?: string;

  @Prop({ type: String })
  type?: string;

  @Prop({
    type: [
      {
        id: String,
        url: String,
        filename: String,
        size: Number,
        storage_url: String,
      },
    ],
  })
  en_attachment?: AttachmentData[];

  @Prop({
    type: [
      {
        id: String,
        url: String,
        filename: String,
        size: Number,
        storage_url: String,
      },
    ],
  })
  fr_attachment?: AttachmentData[];

  @Prop({ type: Date }) date?: Date;
}

export const ReportsSchema = SchemaFactory.createForClass(Reports);

export const ReportsModel = model(Reports.name, ReportsSchema);
