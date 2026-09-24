import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema, Types, type Document } from 'mongoose';
import type { IPortalPages } from '@dua-upd/types-common';

export type PortalPagesDocument = PortalPages & Document;

@Schema({ collection: 'portal_pages' })
export class PortalPages implements IPortalPages {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ required: true, type: String })
  screen_id = '';

  @Prop({ type: String, index: true, default: null })
  title: string | null = null;

  @Prop({ type: String, index: true, default: null })
  url: string | null = null;

  @Prop({ type: String })
  lang?: 'en' | 'fr';
}

export const PortalPagesSchema = SchemaFactory.createForClass(PortalPages);

PortalPagesSchema.index({ screen_id: 1, lang: 1 }, { unique: true });
PortalPagesSchema.index({ title: 1, lang: 1 });
