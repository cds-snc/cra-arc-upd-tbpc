import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AirtableClient } from '@dua-upd/external-data';
import {
  GCTasksMappings,
  type GCTasksMappingsDocument,
  Task,
} from '@dua-upd/db';
import { type Model, Types, type AnyBulkWriteOperation } from 'mongoose';
import {
  Retry,
  arrayToDictionary,
  arrayToDictionaryMultiref,
} from '@dua-upd/utils-common';
import { omit } from 'rambdax';

@Injectable()
export class GCTasksMappingsService {
  constructor(
    @Inject(AirtableClient.name) private airtableClient: AirtableClient,
    private logger: ConsoleLogger,
    @InjectModel(Task.name, 'defaultConnection')
    private taskModel: Model<Task>,
    @InjectModel(GCTasksMappings.name, 'defaultConnection')
    private gcTasksMappingsModel: Model<GCTasksMappingsDocument>,
  ) {}

  @Retry(4, 1000)
  async updateGCTasksMappings() {
    this.logger.log('Updating GC Tasks Mappings...');

    // Get all the tasks airtable ids
    const taskIds = await this.taskModel
      .find({}, { airtable_id: 1 })
      .lean()
      .exec();

    // Create dictionary
    const taskIdsDict = arrayToDictionary(taskIds, 'airtable_id');

    // Replace airtable ids with the ObjectIds
    const gcTasksMappings = (
      await this.airtableClient.getGCTasksMappings()
    ).map((gcTasksMapping) => ({
      ...gcTasksMapping,
      tasks: gcTasksMapping.tasks?.map((id) => taskIdsDict[id]._id),
    }));

    // Create a bulk write
    const bulkWriteOps: AnyBulkWriteOperation<GCTasksMappings>[] =
      gcTasksMappings.map((gcTasksMapping) => ({
        updateOne: {
          filter: { airtable_id: gcTasksMapping.airtable_id },
          update: { $set: gcTasksMapping },
          upsert: true,
        },
      }));

    // Bulk write
    await this.gcTasksMappingsModel.bulkWrite(bulkWriteOps);

    // Get the new mappings to include object ids
    const newGCTasksMappings = await this.gcTasksMappingsModel
      .find({ tasks: { $exists: true } })
      .lean()
      .exec();

    // Flip the mappings to get all gc tasks for each task
    const gcTasksByTmfTask = arrayToDictionaryMultiref(
      newGCTasksMappings,
      'tasks',
      true,
    );

    // Update tasks with the new mappings
    const taskUpdateOps: AnyBulkWriteOperation<Task>[] = Object.entries(
      gcTasksByTmfTask,
    ).map(([taskId, gcTasks]) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(taskId) },
        update: { $set: { gc_tasks: gcTasks.map(omit(['tasks'])) } },
      },
    }));

    await this.taskModel.updateMany({}, { $unset: { gc_tasks: '' } });

    await this.taskModel.bulkWrite(taskUpdateOps, { ordered: false });

    this.logger.log('Successfully updated GC Tasks Mappings');
  }
}
