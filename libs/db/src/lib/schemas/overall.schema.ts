import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { model, Document } from 'mongoose';
import type {
  AASearchTermMetrics,
  IOverall,
} from '@dua-upd/types-common';
import { MetricsCommon } from './metrics-common.schema';

export type OverallDocument = Overall & Document;

@Schema({ collection: 'overall_metrics' })
export class Overall extends MetricsCommon implements IOverall {
  @Prop({ required: true, type: Date, unique: true, index: true })
  date = new Date(0);

  @Prop({
    type: [
      { term: String, clicks: Number, position: Number, num_searches: Number },
    ],
  })
  aa_searchterms_en?: AASearchTermMetrics[];

  @Prop({
    type: [
      { term: String, clicks: Number, position: Number, num_searches: Number },
    ],
  })
  aa_searchterms_fr?: AASearchTermMetrics[];
}

export const OverallSchema = SchemaFactory.createForClass(Overall);

export function getOverallModel() {
  return model(Overall.name, OverallSchema);
}
