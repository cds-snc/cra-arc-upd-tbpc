import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type {
  ActivityMapMetrics,
  DateRange,
  IPage,
  IPageView,
  PageStatus,
} from '@dua-upd/types-common';
import type { ModelWithStatics } from '@dua-upd/utils-common/types';
import { MetricsCommon } from '../schemas/metrics-common.schema';

@Schema({ collection: 'view_pages' })
export class PagesView extends MetricsCommon implements IPageView {
  @Prop({
    required: true,
    type: { start: Date, end: Date },
    index: true,
    _id: false,
  })
  dateRange: DateRange<Date>;

  @Prop({
    type: {
      _id: Types.ObjectId,
      url: String,
      title: String,
      lang: String,
      redirect: String,
      owners: String,
      sections: String,
    },
    required: true,
  })
  page: IPage;

  @Prop({ type: String })
  pageStatus: PageStatus;

  @Prop({ type: Number })
  numComments: number;

  @Prop({
    type: [{ term: String, clicks: Number, position: Number }],
    _id: false,
  })
  aa_searchterms?: {
    term: string;
    clicks: number;
    position: number;
  }[];

  @Prop({
    type: [
      {
        link: String,
        clicks: Number,
      },
    ],
    _id: false,
  })
  activity_map?: ActivityMapMetrics[];

  @Prop({ type: [{ type: Types.ObjectId }], index: true })
  tasks?: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId }], index: true })
  projects?: Types.ObjectId[];

  @Prop({ type: Date, required: true, default: () => new Date(), index: true })
  lastUpdated: Date;
}

export const PagesViewSchema = SchemaFactory.createForClass(PagesView);

PagesViewSchema.index({ 'page._id': 1 });
PagesViewSchema.index({ dateRange: 1, 'page._id': 1 }, { unique: true });
PagesViewSchema.index({ dateRange: 1, tasks: 1 });
PagesViewSchema.index({ dateRange: 1, projects: 1 });
PagesViewSchema.index({ dateRange: 1, 'page._id': 1, lastUpdated: 1 });
PagesViewSchema.index({ dateRange: 1, tasks: 1, lastUpdated: 1 });
PagesViewSchema.index({ dateRange: 1, projects: 1, lastUpdated: 1 });
PagesViewSchema.index(
  { dateRange: 1, tasks: -1 },
  { partialFilterExpression: { 'tasks.0': { $exists: true } } },
);
PagesViewSchema.index(
  { dateRange: 1, projects: -1 },
  { partialFilterExpression: { 'projects.0': { $exists: true } } },
);

const statics = {};

PagesViewSchema.statics = statics;

export type PagesViewModel = ModelWithStatics<PagesView, typeof statics>;
