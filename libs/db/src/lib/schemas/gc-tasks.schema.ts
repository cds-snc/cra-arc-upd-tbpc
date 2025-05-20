import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { model, type Document, Schema as MSchema, Types } from 'mongoose';
import type { DateRange, IGCTasks, ITask } from '@dua-upd/types-common';
import { dateRangeSplit } from '@dua-upd/utils-common/date';
import { ModelWithStatics } from '@dua-upd/utils-common/types';

export type GcTasksDocument = GcTasks & Document;

@Schema({ collection: 'gc_tasks' })
export class GcTasks implements IGCTasks {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: [{ type: MSchema.Types.ObjectId, ref: 'Task' }] })
  tasks?: Types.ObjectId[] | ITask[];

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String })
  time_stamp?: string;

  @Prop({ type: String, required: true, index: true })
  url: string;

  @Prop({ type: String, required: true, index: true })
  language: string;

  @Prop({ type: String })
  device?: string;

  @Prop({ type: Boolean, required: true })
  screener: boolean;

  @Prop({ type: String, required: true })
  department: string;

  @Prop({ type: String })
  theme: string;

  @Prop({ type: String })
  theme_other?: string;

  @Prop({ type: String, index: true })
  grouping?: string;

  @Prop({ type: String, required: true, index: true })
  gc_task: string;

  @Prop({ type: String })
  gc_task_other?: string;

  @Prop({ type: String, required: true, index: true })
  satisfaction: string;

  @Prop({ type: String, required: true, index: true })
  ease: string;

  @Prop({ type: String, required: true, index: true })
  able_to_complete: string;

  @Prop({ type: String })
  what_would_improve?: string;

  @Prop({ type: String })
  what_would_improve_comment?: string;

  @Prop({ type: String })
  reason_not_complete?: string;

  @Prop({ type: String })
  reason_not_complete_comment?: string;

  @Prop({ type: String })
  sampling_invitation?: string;

  @Prop({ type: String })
  sampling_gc?: string;

  @Prop({ type: String })
  sampling_canada?: string;

  @Prop({ type: String })
  sampling_theme?: string;

  @Prop({ type: String })
  sampling_institution?: string;

  @Prop({ type: String })
  sampling_group?: string;

  @Prop({ type: String })
  sampling_task?: string;

  static getTotalEntries(
    this: GcTasksModel,
    dateRange: string | DateRange<Date>,
  ) {
    const [startDate, endDate] =
      typeof dateRange === 'string'
        ? dateRangeSplit(dateRange)
        : [dateRange.start, dateRange.end];

    return this.aggregate<{
      gc_task: string;
      total_entries: number;
      completed_entries: number;
    }>()
      .match({
        date: { $gte: startDate, $lte: endDate },
        sampling_task: 'y',
        able_to_complete: {
          $in: ['Yes', 'No'],
        },
      })
      .group({
        _id: { gc_task: '$gc_task' },
        total_entries: { $sum: 1 },
        completed_entries: {
          $sum: {
            $cond: [{ $eq: ['$able_to_complete', 'Yes'] }, 1, 0],
          },
        },
      })
      .project({
        _id: 0,
        gc_task: '$_id.gc_task',
        total_entries: 1,
        completed_entries: 1,
      })
      .exec();
  }

  static getGcTaskData(
    this: GcTasksModel,
    dateRange: string | DateRange<Date>,
  ) {
    const [startDate, endDate] =
      typeof dateRange === 'string'
        ? dateRangeSplit(dateRange)
        : [dateRange.start, dateRange.end];

    return this.aggregate()
      .match({
        date: { $gte: startDate, $lte: endDate },
        sampling_task: 'y',
        able_to_complete: {
          $in: ['Yes', 'No'],
        },
      })
      .group({
        _id: { gc_task: '$gc_task', theme: '$theme' },
        total_entries: { $sum: 1 },
        satisfaction: {
          $avg: {
            $cond: [
              { $in: ['$satisfaction', ['Very satisfied', 'Satisfied']] },
              1,
              0,
            ],
          },
        },
        ease: {
          $avg: { $cond: [{ $in: ['$ease', ['Very easy', 'Easy']] }, 1, 0] },
        },
        able_to_complete: {
          $avg: { $cond: [{ $eq: ['$able_to_complete', 'Yes'] }, 1, 0] },
        },
      })
      .project({
        gc_task: '$_id.gc_task',
        theme: '$_id.theme',
        total_entries: 1,
        satisfaction: 1,
        ease: 1,
        able_to_complete: 1,
        margin_of_error: avgMarginOfErrorExpr([
          'satisfaction',
          'ease',
          'able_to_complete',
        ]),
      })
      .sort({ total_entries: -1 })
      .project({ _id: 0 })
      .exec();
  }
}

export const GcTasksSchema = SchemaFactory.createForClass(GcTasks);

GcTasksSchema.index({ date: 1, url: 1 });
GcTasksSchema.index({ date: 1, gc_task: 1 });
GcTasksSchema.index({ date: 1, sampling_task: 1, able_to_complete: 1 });

const statics = {
  getTotalEntries: GcTasks.getTotalEntries,
  getGcTaskData: GcTasks.getGcTaskData,
};

GcTasksSchema.statics = statics;

export type GcTasksModel = ModelWithStatics<GcTasks, typeof statics>;

export function getGCTasksModel() {
  return model(GcTasks.name, GcTasksSchema);
}

const marginOfErrorExpr = (prop: string) => ({
  $divide: [
    {
      $add: [
        {
          $multiply: [
            1.96,
            {
              $sqrt: {
                $divide: [
                  {
                    $multiply: [`$${prop}`, { $subtract: [1, `$${prop}`] }],
                  },
                  '$total_entries',
                ],
              },
            },
          ],
        },
      ],
    },
    3,
  ],
});

const avgMarginOfErrorExpr = (props: string[]) => ({
  $divide: [
    {
      $add: props.map((prop) => marginOfErrorExpr(prop)),
    },
    props.length,
  ],
});

// new moe?
// const marginOfErrorExpr = (prop: string) => ({
//   $multiply: [
//     1.96,
//     {
//       $sqrt: {
//         $divide: [
//           {
//             $multiply: [`$${prop}`, { $subtract: [1, `$${prop}`] }],
//           },
//           '$total_entries',
//         ],
//       },
//     },
//   ],
// });

// const avgMarginOfErrorExpr = (props: string[]) => ({
//   $cond: {
//     if: { $gte: ['$total_entries', 30] },
//     then: {
//       $avg: props.map((prop) => marginOfErrorExpr(prop)),
//     },
//     else: 'N/A',
//   },
// });