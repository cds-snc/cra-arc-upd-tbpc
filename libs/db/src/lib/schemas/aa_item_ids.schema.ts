import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MSchema, Types } from 'mongoose';
import type { IAAItemId, AAItemIdTypes } from '@dua-upd/types-common';

export type AAItemIdsDocument = AAItemId & Document;

@Schema({ collection: 'aa_item_ids' })
export class AAItemId implements IAAItemId {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id = new Types.ObjectId();

  @Prop({ type: String, index: true })
  type!: AAItemIdTypes;

  @Prop({ type: MSchema.Types.ObjectId, index: true })
  page?: Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, index: true })
  pages?: Types.ObjectId[];

  @Prop({ type: String, required: true, unique: true, index: true })
  itemId!: string;

  @Prop({ type: String, required: true, index: true })
  value!: string;
}

export const AAItemIdSchema = SchemaFactory.createForClass(AAItemId);
