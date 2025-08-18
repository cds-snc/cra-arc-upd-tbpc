import type { AnyBulkWriteOperation, Model, mongo } from 'mongoose';

export async function batchWrite<ModelT extends Model<any>>(
  model: ModelT,
  operations: AnyBulkWriteOperation[],
  options?: { batchSize: number } & mongo.BulkWriteOptions,
): Promise<number> {
  // assume all operations are the same
  if (operations.length === 0) {
    return 0;
  }

  let totalModifiedCount = 0;

  const batchSize = options?.batchSize || 1;

  while (operations.length !== 0) {
    const batch = operations.splice(0, batchSize);

    const result = await model.bulkWrite(batch, options);
    totalModifiedCount += result.modifiedCount || 0;
  }

  return totalModifiedCount;
}
