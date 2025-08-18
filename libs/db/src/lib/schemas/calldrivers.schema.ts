import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  type Document,
  Schema as MSchema,
  Types,
  type Model,
  type mongo,
  type FilterQuery,
  type AnyBulkWriteOperation,
} from 'mongoose';
import type {
  CallsByTasks,
  CallsByTopic,
  DateRange,
  ICallDriver,
  TopCalldriverTopics,
} from '@dua-upd/types-common';
import {
  type ModelWithStatics,
  percentChange,
  arrayToDictionaryMultiref,
  arrayToDictionary,
  dateRangeSplit,
} from '@dua-upd/utils-common';
import { Task } from './task.schema';
import { batchWrite } from '../utils';

export type CallDriverDocument = CallDriver & Document;

@Schema()
export class CallDriver implements ICallDriver {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ type: String })
  airtable_id = '';

  @Prop({ type: Date, required: true, index: true })
  date = new Date(0);

  @Prop({ type: String, required: true, index: true })
  enquiry_line = '';

  @Prop({ type: String })
  topic?: string;

  @Prop({ type: String })
  subtopic?: string;

  @Prop({ type: String })
  sub_subtopic?: string;

  @Prop({ type: Number, index: true })
  tpc_id = 999999; // Some records don't have a tpc_id, so they will default to this value

  @Prop({ type: Number })
  impact = 0;

  @Prop({ type: Number })
  calls = 0;

  @Prop({ type: Number })
  selfserve_yes?: number;

  @Prop({ type: Number })
  selfserve_no?: number;

  @Prop({ type: Number })
  selfserve_na?: number;

  @Prop({ type: [MSchema.Types.ObjectId], index: true })
  tasks?: Types.ObjectId[];

  @Prop({ type: [MSchema.Types.ObjectId], index: true })
  projects?: Types.ObjectId[];

  static async getCallsByTopicFromIds(
    this: CallDriverModel,
    documentIds: Types.ObjectId[],
  ): Promise<CallsByTopic[]> {
    return this.aggregate()
      .match({ _id: { $in: documentIds } })
      .project({
        _id: 0,
        tpc_id: 1,
        enquiry_line: 1,
        topic: 1,
        subtopic: 1,
        sub_subtopic: 1,
        calls: 1,
      })
      .lookup({
        from: 'tasks',
        localField: 'tpc_id',
        foreignField: 'tpc_ids',
        as: 'tasks',
      })
      .group({
        _id: '$tpc_id',
        topic: { $first: '$topic' },
        enquiry_line: { $first: '$enquiry_line' },
        subtopic: { $first: '$subtopic' },
        sub_subtopic: { $first: '$sub_subtopic' },
        tasks: { $first: '$tasks.title' },
        calls: { $sum: '$calls' },
      })
      .project({
        _id: 0,
        tpc_id: '$_id',
        topic: 1,
        enquiry_line: 1,
        subtopic: 1,
        sub_subtopic: 1,
        tasks: 1,
        calls: 1,
      })
      .exec();
  }

  static async getCallsByTopic(
    this: CallDriverModel,
    dateRange: string | DateRange<Date>,
    idFilter?:
      | { page: Types.ObjectId }
      | { tasks: Types.ObjectId }
      | { projects: Types.ObjectId },
    setTaskTitle?: string,
  ): Promise<CallsByTopic[]> {
    const [startDate, endDate] =
      typeof dateRange === 'string'
        ? dateRangeSplit(dateRange)
        : [dateRange.start, dateRange.end];

    const matchFilter: FilterQuery<CallDriver> = {
      date: { $gte: startDate, $lte: endDate },
      ...(idFilter || {}),
    };

    const pipeline = this.aggregate<CallsByTopic>().match(matchFilter);

    if (!setTaskTitle) {
      pipeline.lookup({
        from: 'tasks',
        localField: 'tasks.0',
        foreignField: '_id',
        as: 'tasks',
      });
    }

    return pipeline
      .group({
        _id: '$tpc_id',
        topic: { $first: '$topic' },
        enquiry_line: { $first: '$enquiry_line' },
        subtopic: { $first: '$subtopic' },
        sub_subtopic: { $first: '$sub_subtopic' },
        tasks: { $first: '$tasks' },
        calls: { $sum: '$calls' },
      })
      .project({
        _id: 0,
        tpc_id: '$_id',
        topic: 1,
        enquiry_line: 1,
        subtopic: 1,
        sub_subtopic: 1,
        tasks: setTaskTitle || '$tasks.title',
        calls: 1,
      })
      .exec()
      .then((callsByTopic) => callsByTopic || []);
  }

  static async getCallsByEnquiryLineFromIds(
    this: CallDriverModel,
    documentIds: Types.ObjectId[],
  ): Promise<{ enquiry_line: string; calls: number }[]> {
    return this.aggregate()
      .match({ _id: { $in: documentIds } })
      .project({ enquiry_line: 1, calls: 1 })
      .group({ _id: '$enquiry_line', calls: { $sum: '$calls' } })
      .project({ _id: 0, calls: 1, enquiry_line: '$_id' })
      .sort({ enquiry_line: 'asc' })
      .exec();
  }

  static async getCallsByEnquiryLine(
    this: CallDriverModel,
    dateRange: string | DateRange<Date>,
    idFilter?:
      | { page: Types.ObjectId }
      | { tasks: Types.ObjectId }
      | { projects: Types.ObjectId },
  ): Promise<{ enquiry_line: string; calls: number }[]> {
    const [startDate, endDate] =
      typeof dateRange === 'string'
        ? dateRangeSplit(dateRange)
        : [dateRange.start, dateRange.end];

    const projection = idFilter
      ? Object.fromEntries(Object.keys(idFilter).map((key) => [key, 1]))
      : {};

    const matchFilter: FilterQuery<CallDriver> = {
      date: { $gte: startDate, $lte: endDate },
      ...(idFilter || {}),
    };

    return this.aggregate<{ enquiry_line: string; calls: number }>()
      .match(matchFilter)
      .project({ date: 1, enquiry_line: 1, calls: 1, ...projection })
      .group({ _id: '$enquiry_line', calls: { $sum: '$calls' } })
      .project({ _id: 0, calls: 1, enquiry_line: '$_id' })
      .sort({ enquiry_line: 'asc' })
      .exec();
  }

  static async getCallsByTpcId(
    this: CallDriverModel,
    dateRange: string,
    tpcIds: number[],
  ): Promise<CallsByTasks[]> {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    return this.aggregate()
      .match({
        date: { $gte: startDate, $lte: endDate },
        tpc_id: { $in: tpcIds },
      })
      .group({ _id: '$tpc_id', calls: { $sum: '$calls' } })
      .project({ _id: 0, calls: 1 })
      .exec();
  }

  static async getCallsByTask(this: CallDriverModel, dateRange: string) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    return this.aggregate<{ task: Types.ObjectId; calls: number }>()
      .match({
        date: { $gte: startDate, $lte: endDate },
        tasks: { $exists: true },
      })
      .group({
        _id: '$tpc_id',
        tasks: { $first: '$tasks' },
        calls: { $sum: '$calls' },
      })
      .unwind('$tasks')
      .group({ _id: '$tasks', calls: { $sum: '$calls' } })
      .project({ _id: 0, task: '$_id', calls: 1 })
      .exec();
  }

  static async getTopicsWithPercentChange(
    this: CallDriverModel,
    dateRange: string,
    comparisonDateRange: string,
    tpcIds?: number[],
  ): Promise<TopCalldriverTopics[]> {
    const [currentData, previousData] = await Promise.all(
      [dateRange, comparisonDateRange].map((dateRange) => {
        const [startDate, endDate] = dateRange
          .split('/')
          .map((d) => new Date(d));

        const tpcIdsQuery = tpcIds?.length ? { tpc_id: { $in: tpcIds } } : {};

        return this.aggregate<TopCalldriverTopics>()
          .sort({ date: 1, tpc_id: 1 })
          .match({ date: { $gte: startDate, $lte: endDate }, ...tpcIdsQuery })
          .lookup({
            from: 'tasks',
            localField: 'tpc_id',
            foreignField: 'tpc_ids',
            as: 'tasks',
          })
          .group({
            _id: '$tpc_id',
            enquiry_line: { $first: '$enquiry_line' },
            topic: { $first: '$topic' },
            subtopic: { $first: '$subtopic' },
            sub_subtopic: { $first: '$sub_subtopic' },
            tasks: { $first: '$tasks.title' },
            calls: { $sum: '$calls' },
          })
          .project({
            _id: 0,
            enquiry_line: 1,
            tpc_id: '$_id',
            topic: 1,
            subtopic: 1,
            sub_subtopic: 1,
            tasks: 1,
            calls: 1,
          })
          .exec() as Promise<TopCalldriverTopics[]>;
      }),
    );

    const currentDataMap = new Map(
      currentData.map((topicData) => [topicData.tpc_id, topicData]),
    );
    const previousDataMap = new Map(
      previousData.map((topicData) => [topicData.tpc_id, topicData]),
    );

    return [...currentDataMap.keys()]
      .map((tpcId) => {
        const currentData = currentDataMap.get(tpcId);
        const previousData = previousDataMap.get(tpcId);

        return {
          ...currentData,
          change: !previousData?.calls
            ? null
            : percentChange(currentData.calls, previousData.calls),
          difference: currentData.calls - (previousData?.calls ?? 0),
        };
      })
      .sort((a, b) => (b.calls ?? 0) - (a.calls ?? 0));
  }

  static async getCallsByTaskFromIds(
    this: CallDriverModel,
    dateRange: string,
    documentIds: number[],
  ): Promise<CallsByTasks[]> {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    return this.aggregate([
      {
        $match: {
          tpc_id: { $in: documentIds },
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'tpc_id',
          foreignField: 'tpc_ids',
          as: 'task',
        },
      },
      { $unwind: '$task' },
      {
        $group: {
          _id: '$task._id',
          title: { $first: '$task.title' },
          calls: { $sum: '$calls' },
        },
      },
      { $project: { _id: 0, title: 1, calls: 1 } },
    ]).exec();
  }

  static async syncTaskReferences(
    this: CallDriverModel,
    tasksModel: Model<Task>,
  ): Promise<number> {
    const tasks = await tasksModel
      .find({ tpc_ids: { $ne: [] } }, { projects: 1, tpc_ids: 1 })
      .lean()
      .exec();

    const topicIdTasksMap = arrayToDictionaryMultiref(tasks, 'tpc_ids', true);

    const topicIdMap = Object.fromEntries(
      Object.entries(topicIdTasksMap).map(([tpcId, tasks]) => [
        tpcId,
        tasks.map((task) => task._id),
      ]),
    );

    const taskProjectsMap = arrayToDictionary(tasks, '_id');

    const bulkWriteOps = Object.entries(topicIdMap).map(([tpcId, tasks]) => {
      const projects = [
        ...new Set(
          tasks.flatMap(
            (taskId) =>
              (taskProjectsMap[taskId.toString()]?.projects ??
                []) as Types.ObjectId[],
          ),
        ),
      ];

      return {
        updateMany: {
          filter: { tpc_id: parseInt(tpcId, 10) },
          update: { tasks, projects },
        },
      };
    }) satisfies AnyBulkWriteOperation<CallDriver>[];

    if (bulkWriteOps.length) {
      return batchWrite(this, bulkWriteOps, { batchSize: 10, ordered: false });
    }
  }
}

export const CallDriverSchema = SchemaFactory.createForClass(CallDriver);

CallDriverSchema.index({ date: 1, tpc_id: 1 });
CallDriverSchema.index({ date: 1, tasks: 1 });
CallDriverSchema.index({ date: 1, projects: 1 });

const statics = {
  getCallsByTopicFromIds: CallDriver.getCallsByTopicFromIds,
  getCallsByTopic: CallDriver.getCallsByTopic,
  getCallsByEnquiryLineFromIds: CallDriver.getCallsByEnquiryLineFromIds,
  getCallsByEnquiryLine: CallDriver.getCallsByEnquiryLine,
  getTopicsWithPercentChange: CallDriver.getTopicsWithPercentChange,
  getCallsByTpcId: CallDriver.getCallsByTpcId,
  getCallsByTaskFromIds: CallDriver.getCallsByTaskFromIds,
  getCallsByTask: CallDriver.getCallsByTask,
  syncTaskReferences: CallDriver.syncTaskReferences,
};

CallDriverSchema.statics = statics;

export type CallDriverModel = ModelWithStatics<CallDriver, typeof statics>;
