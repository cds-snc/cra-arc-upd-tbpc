import { availableParallelism, freemem } from 'os';
import { Inject, Injectable, BeforeApplicationShutdown } from '@nestjs/common';
import { drizzle, DuckDBDatabase } from '@duckdbfan/drizzle-duckdb2';
import { type DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { BlobStorageService } from '@dua-upd/blob-storage';
import { duckDbTable } from './duckdb.table';
import { DuckDbExtensionsManager } from './duckdb.utils';

export type DuckDBClientOptions = {
  readOnly?: boolean;
  logger?: boolean;
  numThreads?: number;
  /**
   * Maximum memory limit in MB for DuckDB
   *
   * @example
   * { memoryLimit: 1024 } // 1 GB
   * */
  memoryLimit?: number | 'auto';
};

export const htmlSnapshotTable = pgTable('html', {
  url: text('url'),
  page: text('page'), // objectId hex string
  hash: text('hash'),
  html: text('html'),
  date: timestamp('date'),
});

export type HtmlSnapshot = typeof htmlSnapshotTable.$inferSelect;

@Injectable()
export class DuckDbService implements BeforeApplicationShutdown {
  readonly isReadOnly: boolean = !!this.options?.readOnly;

  readonly remote = {
    html: duckDbTable(this.db, {
      name: 'html',
      filename: 'hashes-html.parquet',
      blobClient: this.blob.blobModels.html_snapshots!, // let it throw an error if clients are null
      backupBlobClient: this.blob.blobModels.html_snapshots_backup!,
      tableCreationSql: `
          CREATE TABLE IF NOT EXISTS html (
            url TEXT,
            page TEXT,
            hash TEXT,
            html TEXT,
            date TIMESTAMP
          )`,
      table: htmlSnapshotTable,
    }),
  } as const;

  private constructor(
    readonly connectionString: string,
    private _client: DuckDBConnection,
    private _db: DuckDBDatabase,
    @Inject(BlobStorageService.name) private blob: BlobStorageService,
    private options?: DuckDBClientOptions,
  ) {}

  get client() {
    return this._client;
  }

  get db() {
    return this._db;
  }

  static async create(
    connectionString: string | ':memory:' = ':memory:',
    blob: BlobStorageService,
    options?: DuckDBClientOptions,
  ) {
    const instance =
      connectionString != ':memory:'
        ? await DuckDBInstance.fromCache(connectionString)
        : await DuckDBInstance.create(connectionString);

    const client = await instance.connect();

    const duckDb = drizzle(client, { logger: options?.logger ?? false });

    return new DuckDbService(connectionString, client, duckDb, blob, options);
  }

  async setupRemoteExtensions() {
    const extensionsManager = new DuckDbExtensionsManager(this.db);

    const prefix = process.env['STORAGE_URI_PREFIX'];

    if (!prefix) {
      throw new Error('STORAGE_URI_PREFIX is not set');
    }

    if (prefix === 's3://') {
      await extensionsManager.installExtension('httpfs');
      await extensionsManager.installExtension('aws');
    } else {
      await extensionsManager.installExtension('azure');
    }
  }

  async setupRemoteAuth() {
    const prefix = process.env['STORAGE_URI_PREFIX'];

    if (!prefix) {
      throw new Error('STORAGE_URI_PREFIX is not set');
    }

    if (prefix === 's3://') {
      try {
        await this.db.execute(`
        CREATE OR REPLACE SECRET s3 (
          TYPE s3,
          PROVIDER credential_chain,
          REGION 'ca-central-1',
          REFRESH auto
        ); 
      `);
      } catch (error) {
        console.error('Error creating S3 secret:', error);
      }
    } else {
      try {
        await this.db.execute(`
          CREATE SECRET blob_storage (
            TYPE azure,
            CONNECTION_STRING '${process.env['AZURE_STORAGE_CONNECTION_STRING']}'
          );  
        `);

        await this.db.execute(`
          SET azure_transport_option_type = 'curl';
        `);
      } catch (error) {
        console.error('Error creating Azure secret:', error);
      }
    }
  }

  async configure(options?: DuckDBClientOptions) {
    this.connectionString !== ':memory:' &&
      options?.readOnly &&
      (await this.db.execute(`SET access_mode = 'READ_ONLY';`));

    const systemMemoryMB = freemem() / (1024 * 1024);
    const memoryLimit =
      options?.memoryLimit || Math.floor(systemMemoryMB * 0.7); // default to 70% of available system memory
    await this.db.execute(`SET memory_limit = '${memoryLimit}MB';`);

    const numThreads = options?.numThreads || availableParallelism() - 1 || 1;
    numThreads && (await this.db.execute(`SET threads = ${numThreads};`));
  }

  async disconnect() {
    await this.db.close();
  }

  async beforeApplicationShutdown() {
    return await this.db.close();
  }
}
