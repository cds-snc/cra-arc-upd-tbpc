import chalk from 'chalk';
import { pick } from 'rambdax';
import { batchAwait, createUpdateQueue, days } from '@dua-upd/utils-common';
import type {
  AggregateOptions,
  AnyBulkWriteOperation,
  FilterQuery,
  Model,
  mongo,
  MongooseBulkWriteOptions,
  ProjectionType,
  QueryOptions,
  Schema,
  UpdateOneModel,
} from 'mongoose';
import { DateRange } from '@dua-upd/types-common';
import { ViewDataService } from './views/view.data.service';

export type DocT<SchemaT> = SchemaT extends Schema<infer Doc> ? Doc : never;
export type ModelT<SchemaT> = Model<DocT<SchemaT>>;

export type ViewConfig<SchemaT> = {
  model: ModelT<SchemaT>;
  name: string;
  schema: SchemaT;
  maxAge?: number;
  refreshBatchSize?: number;
  bulkWriteOptions?: mongo.BulkWriteOptions & MongooseBulkWriteOptions;
};

export abstract class DbViewNew<
  SchemaInner extends { lastUpdated?: Date },
  SchemaT extends Schema<SchemaInner>,
  BaseDoc extends Record<string, unknown>,
  RefreshContext extends Record<string, unknown>,
> {
  protected readonly _model: ModelT<SchemaT>;
  readonly name: string;
  readonly schema: SchemaT;
  readonly maxAge: number;
  private readonly refreshBatchSize: number;
  private bulkWriteOptions?: mongo.BulkWriteOptions & MongooseBulkWriteOptions;

  /**
   * ViewDataService is used to handle concurrency and centralize view data updates
   */
  private readonly dataService = new ViewDataService(this);

  /**
   * The properties of the query filters that will trigger a staleness check
   */
  protected abstract readonly refreshFilterProps: (keyof QueryOptions<
    DocT<SchemaT>
  >)[];

  protected constructor(config: ViewConfig<SchemaT>) {
    this._model = config.model;
    this.name = config.name;
    this.schema = config.schema;
    this.maxAge = config.maxAge || days(2);
    this.refreshBatchSize = config.refreshBatchSize || 25;
  }

  get model() {
    console.warn(
      `BE AWARE: Accessing ${this._model.modelName}'s model directly with ` +
        `\`${this._model.modelName}._model\` bypasses all logic that automatically ` +
        `keeps the data fresh. Use with caution!`,
    );
    return this._model;
  }

  /**
   * Main method to populate/refresh the data, corresponding to a single document write.
   *
   * @param ctx The context object containing the relevant data and metadata
   *            that will be passed to the refresh method
   *
   * @param baseDoc The base document holding data relating to a specific document to be refreshed
   *
   * @returns The BulkWrite operation to be executed for a single document write
   */
  protected abstract refresh(
    baseDoc: BaseDoc,
    ctx: RefreshContext,
  ): Promise<
    | { updateOne: UpdateOneModel<DocT<SchemaT>> & { upsert: true } }
    | { updateOne: UpdateOneModel<DocT<SchemaT>> & { upsert: true } }[]
  >;

  /**
   * Prepare data/metadata to be made available for the refresh loop
   *
   * @param filter The Filter to use for refreshing only a subset of the data.
   */
  abstract prepareRefreshContext(
    filter: FilterQuery<DocT<SchemaT>> & {
      dateRange?: { start: Date; end: Date };
    },
  ): Promise<{ baseDocs: BaseDoc[]; ctx?: RefreshContext }>;

  async performRefresh(filter: { dateRange: DateRange<Date> }) {
    if (
      !filter.dateRange ||
      !(filter.dateRange.start instanceof Date) ||
      !(filter.dateRange.end instanceof Date)
    ) {
      throw new Error(
        `Invalid or missing dateRange filter was passed to the ${this.name} \`refresh()\` method`,
      );
    }

    const bulkWriteQueue = createUpdateQueue<AnyBulkWriteOperation>(
      this.refreshBatchSize,
      async (ops) => {
        try {
          await this._model.bulkWrite(ops, this.bulkWriteOptions);
        } catch (err) {
          console.error((<Error>err).stack);
        }
      },
    );

    try {
      const { baseDocs, ctx } = await this.prepareRefreshContext(filter);

      await batchAwait(
        baseDocs,
        async (baseDoc) => {
          try {
            const writeOps = await this.refresh(baseDoc, ctx);

            if (!writeOps || (<[]>writeOps).length === 0) {
              return;
            }

            if (Array.isArray(writeOps)) {
              return Promise.all(writeOps.map((op) => bulkWriteQueue.add(op)));
            }

            return bulkWriteQueue.add(writeOps);
          } catch (e) {
            console.error(
              `An error occurred while refreshing the following document in ${this.name}:`,
            );

            console.error(JSON.stringify(baseDoc, null, 2));
            console.error(e);
          }
        },
        this.refreshBatchSize,
      );
    } catch (e) {
      // todo: blob logging/better error handling
      console.error(
        `An error occurred while preparing the refresh context for ${this.name}`,
      );
      // console.error(e.stack);
      console.error(e);
    } finally {
      await bulkWriteQueue.flush();
    }
  }

  isPastExpiry(lastUpdated: Date | void) {
    // If there's no data, we want to "refresh" it
    if (!lastUpdated) {
      return true;
    }

    // If there's no maxAge, the data never goes stale and needs to be refreshed explicitly
    if (!this.maxAge) {
      return false;
    }

    return Date.now() - lastUpdated.getTime() > this.maxAge;
  }

  async getLastUpdated(dateRange: DateRange<Date>) {
    return (
      (await this._model
        .findOne({ dateRange }, { dateRange: 1, lastUpdated: 1 })
        .lean()
        .exec()) as { lastUpdated: Date } | null
    )?.lastUpdated as Date | null;
  }

  /**
   * Refresh the view data if it's older than the maxAge
   * @param filter The Filter to use for refreshing only a subset of the data.
   *
   * ** **Passing a filter without a valid dateRange will not refresh any data** **
   */
  async refreshIfStale(filter: FilterQuery<DocT<SchemaT>>) {
    if (filter.dateRange) {
      await this.dataService.ensureData(filter.dateRange);
    }
  }

  /**
   * A wrapper around Mongoose Model.find that first checks if the data is stale
   * and refreshes it if necessary.
   *
   * **Note** — Top-level MongoDB operators like `$or` and `$and` are not passed on to the `refresh` method.
   * @param filter Model.find FilterQuery
   * @param projection Model.find ProjectionType
   * @param options Model.find QueryOptions
   * @param silenceWarning Whether to silence the warning about top-level MongoDB operators
   * @returns
   */
  async find<ReturnT = DocT<SchemaT>>(
    filter?: FilterQuery<DocT<SchemaT>>,
    projection: ProjectionType<DocT<SchemaT>> = {},
    options: QueryOptions<DocT<SchemaT>> = {},
    silenceWarning = false,
  ): Promise<ReturnT[] | null> {
    if (
      !silenceWarning &&
      Object.keys(filter).find((key) => key.startsWith('$'))
    ) {
      console.warn(
        chalk.yellowBright(
          `Top-level MongoDB operators like $or and $and are not passed on to the ` +
            `${this._model.modelName}.refresh method, and therefore might refresh ` +
            `the entire view on each call!`,
        ),
      );
    }

    const refreshFilter = pick(this.refreshFilterProps, filter);

    await this.refreshIfStale(refreshFilter as FilterQuery<DocT<SchemaT>>);

    return this._model
      .find(filter, projection, options)
      .lean<ReturnT[] | null>()
      .exec();
  }

  /**
   * A wrapper around Mongoose Model.findOne that first checks if the data is stale
   * and refreshes it if necessary.
   *
   * **Note** — Top-level MongoDB operators like `$or` and `$and` are not passed on to the `refresh` method.
   * @param filter Model.findOne FilterQuery
   * @param projection Model.findOne ProjectionType
   * @param options Model.findOne QueryOptions
   * @param silenceWarning Whether to silence the warning about top-level MongoDB operators
   * @returns
   */
  async findOne<ReturnT = DocT<SchemaT>>(
    filter: FilterQuery<DocT<SchemaT>>,
    projection: ProjectionType<DocT<SchemaT>> = {},
    options: QueryOptions<DocT<SchemaT>> = {},
    silenceWarning = false,
  ) {
    if (
      !silenceWarning &&
      Object.keys(filter).find((key) => key.startsWith('$'))
    ) {
      console.warn(
        chalk.yellowBright(
          `Top-level MongoDB operators like $or and $and are not passed on to the ` +
            `${this._model.modelName}.refresh method, and therefore might refresh ` +
            `the entire view on each call!`,
        ),
      );
    }

    await this.refreshIfStale(filter);

    return this._model
      .findOne(filter, projection, options)
      .lean<ReturnT>()
      .exec();
  }

  /**
   * Same as the mongoose `Model.aggregate`, but with automatic refresh of the data if it's stale.
   *
   * @param filter The filter passed to the `match` stage of the aggregation pipeline
   * @param options The options passed to the `aggregate` method
   *
   * Note that the signature is slightly different from the original method, where in this case,
   * the `filter` parameter is required and automatically passed to the `match` stage of the pipeline.
   */
  aggregate<T>(filter: FilterQuery<DocT<SchemaT>>, options?: AggregateOptions) {
    const refreshFilter = pick(this.refreshFilterProps, filter);

    return new Proxy(this._model.aggregate<T>([], options).match(filter), {
      get: (target, prop) => {
        if (prop === 'exec') {
          return async () => {
            await this.refreshIfStale(
              refreshFilter as FilterQuery<DocT<SchemaT>>,
            );
            return target.exec();
          };
        }
        return target[prop];
      },
    });
  }

  /**
   * Delete all data in the collection
   * @returns mongo.DeleteResult
   */
  async clearAll(): Promise<mongo.DeleteResult> {
    return this._model.deleteMany({}).exec();
  }

  /**
   * Method to delete all documents where the original source no longer exists
   * @returns mongo.DeleteResult
   */
  abstract clearNonExisting(): Promise<mongo.DeleteResult | null>;

  /**
   * Method to delete all documents where the dateRange is not in the provided list
   * @param dateRanges The list of dateRanges to keep
   * @returns The number of documents deleted
   */
  async clearUnusedDateRanges(dateRanges: DateRange<Date>[]) {
    const dbDateRanges = await this._model.distinct('dateRange').exec();

    const dateRangeStrings = dateRanges.map((dateRange) =>
      JSON.stringify(dateRange),
    );

    const dateRangesToDelete = dbDateRanges
      .map((dateRange) =>
        dateRangeStrings.includes(JSON.stringify(dateRange)) ? null : dateRange,
      )
      .filter((dateRange) => dateRange !== null) as DateRange<Date>[];

    if (!dateRangesToDelete.length) {
      return 0;
    }

    const deletionDateRangeStrings = dateRangesToDelete.map(
      ({ start, end }) =>
        `${start.toISOString().slice(0, 10)}/${end.toISOString().slice(0, 10)}`,
    );

    console.log(`Deleting date ranges: ${deletionDateRangeStrings}`);

    return await Promise.all(
      dateRangesToDelete.map((dateRange) =>
        this._model.deleteMany({ dateRange }),
      ),
    ).then((results) =>
      results.reduce((acc, { deletedCount }) => acc + deletedCount, 0),
    );
  }
}
