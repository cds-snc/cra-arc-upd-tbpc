import { sql, type SQLWrapper, type DrizzleTypeError } from 'drizzle-orm';
import {
  type PgInsertValue,
  type PgTableWithColumns,
  type SelectedFields,
  type TableLikeHasEmptySelection,
} from 'drizzle-orm/pg-core';
import type { DuckDBDatabase } from '@duckdbfan/drizzle-duckdb';
import type { IStorageModel, S3Bucket } from '@dua-upd/blob-storage';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { ContainerClient } from '@azure/storage-blob';

type BlobModel = IStorageModel<S3Bucket | ContainerClient>;

export type DuckDbStorageConfig<Table extends PgTableWithColumns<any>> = {
  name: string;
  table: Table;
  tableCreationSql: SQLWrapper | string;
  filename: string;
  blobClient: BlobModel;
  backupBlobClient: BlobModel;
};

export type DrizzleTable<Table extends PgTableWithColumns<any>> =
  TableLikeHasEmptySelection<Table> extends true
    ? DrizzleTypeError<"Cannot reference a data-modifying statement subquery if it doesn't contain a `returning` clause">
    : Table;

export type OrderBy<Table extends PgTableWithColumns<any>> = {
  [Key in Table['_']['columns'][keyof Table['_']['columns']] | string]:
    | 'ASC'
    | 'DESC';
};

const getStorageUriPrefix = () => process.env['STORAGE_URI_PREFIX'];

export class DuckDbTable<Table extends PgTableWithColumns<any>> {
  readonly name: string;
  readonly table: Table;
  readonly filename: string;
  readonly blobClient: BlobModel;
  readonly backupBlobClient: BlobModel;
  readonly storagePath: string;
  readonly backupStoragePath: string;

  constructor(
    private readonly db: DuckDBDatabase,
    private readonly config: DuckDbStorageConfig<Table>,
  ) {
    this.name = config.name;
    this.table = config.table;
    this.filename = config.filename;
    this.blobClient = config.blobClient;
    this.backupBlobClient = config.backupBlobClient;
    this.storagePath = config.blobClient.getPath();
    this.backupStoragePath = config.backupBlobClient.getPath();
  }

  async backupRemote() {
    const backupFilename = this.filename.replace(
      /\.parquet$/,
      `_${new Date().toISOString().slice(0, 10)}.parquet`,
    );

    const backupFilePath = `${this.backupBlobClient.getPath()}/${backupFilename}`;

    const blobClient = this.blobClient.blob(this.filename);
    const backupBlobClient = this.backupBlobClient.blob(backupFilename);

    console.log(`Backing up ${blobClient.url} to ${backupBlobClient.url}...`);

    await backupBlobClient?.copyFromUrl(blobClient.url);

    console.log(`Backup complete for ${backupFilePath}`);
  }

  async createLocalTable() {
    await this.db.execute(this.config.tableCreationSql);
  }

  async deleteLocalTable() {
    await this.db.execute(sql`DROP TABLE IF EXISTS ${this.table}`);
  }

  async insertLocal(data: PgInsertValue<Table>[]) {
    await this.db.insert(this.table).values(data).execute();
  }

  async appendLocalToRemote(options?: {
    orderBy?: OrderBy<Table>;
    compressionLevel?: number;
    rowGroupSize?: number;
    useTmpFile?: boolean;
  }) {
    // to get around bug in drizzle-duckdb causing column names to be "tableName.columnName"
    // and the "fake" table causing the select to be empty
    const selectAll = Object.fromEntries(
      Object.keys(this.table)
        .filter((key) => key !== 'enableRLS')
        .map((key) => [key, this.table[key]]),
    );

    const selectLocalSql = this.db
      .select(selectAll)
      .from(this.table as DrizzleTable<Table>);

    const currentRemoteFilename = this.filename.replace(
      /\.parquet$/,
      '.current.parquet',
    );

    const newDataFilename = this.filename.replace(/\.parquet$/, '.new.parquet');

    const orderByClause = options?.orderBy
      ? `ORDER BY ${Object.entries(options.orderBy)
          .map(([column, direction]) => `${column} ${direction}`)
          .join(', ')}`
      : '';

    // todo maybe: add dedicated parquet options parsing/formatting?
    const compressionLevel = options?.compressionLevel
      ? `COMPRESSION_LEVEL ${options.compressionLevel}`
      : 'COMPRESSION_LEVEL 7';

    const rowGroupSize = options?.rowGroupSize
      ? `ROW_GROUP_SIZE ${options.rowGroupSize}`
      : null;

    const useTmpFile =
      typeof options?.useTmpFile === 'boolean'
        ? `USE_TMP_FILE ${options.useTmpFile}`
        : null;

    const optionsSql = [compressionLevel, rowGroupSize, useTmpFile]
      .filter(Boolean)
      .join(', ');

    console.log(`Creating new ${newDataFilename}...`);
    console.time('Creating new data file');
    await this.db.execute(
      sql`COPY (${selectLocalSql})
      TO '${sql.raw(newDataFilename)}' (FORMAT parquet, COMPRESSION zstd, ${sql.raw(optionsSql)})`,
    );
    console.timeEnd('Creating new data file');

    console.log(`Downloading ${this.filename} to ${currentRemoteFilename}`);
    console.time('Downloading remote file to local disk');
    await this.blobClient
      .blob(this.filename)
      .downloadToFile(currentRemoteFilename);
    console.timeEnd('Downloading remote file to local disk');

    console.log('Creating combined parquet...');
    console.time('Creating combined parquet');
    await this.db.execute(
      sql`
        COPY (
          SELECT * FROM read_parquet([
            '${sql.raw(currentRemoteFilename)}',
            '${sql.raw(newDataFilename)}'
          ])
          ${sql.raw(orderByClause)}
        ) TO '${sql.raw(this.filename)}' (FORMAT parquet, COMPRESSION zstd, ${sql.raw(optionsSql)})
      `,
    );
    console.timeEnd('Creating combined parquet');

    console.log(`Wrote new ${this.filename}, uploading to remote storage...`);

    const uploadStreamBufferSize = 8 * 1024 * 1024; // 8MB buffer size

    const blobClient = this.blobClient.blob(this.filename);

    const response = await blobClient.uploadStream(
      createReadStream(this.filename, {
        highWaterMark: uploadStreamBufferSize,
      }),
    );

    if ('ETag' in response) {
      // S3 response
      console.log(
        `Upload complete with ETag: ${response.ETag} (versionId: ${response.VersionId})`,
      );
    } else if ('requestId' in response) {
      // Azure response
      console.log(
        `Upload complete with MD5: ${response.contentMD5} (versionId: ${response.versionId})`,
      );
    }

    console.log(
      `Uploaded ${this.filename} to remote storage, deleting local copy...`,
    );

    await rm(this.filename);
    await rm(currentRemoteFilename);
    await rm(newDataFilename);

    console.log(`Deleted local copies of ${this.filename}`);

    console.log(`Remote table update complete`);
  }

  selectRemote<TSelection extends SelectedFields>(selection?: TSelection) {
    const fullRemotePath = `${getStorageUriPrefix()}${this.storagePath}/${this.filename}`;

    const parquetSql = sql.raw(
      `read_parquet('${fullRemotePath}') as "${this.name}"`,
    ) as unknown as DrizzleTable<Table>;

    return selection
      ? this.db.select(selection).from(parquetSql)
      : // bug in drizzle-duckdb where empty select doesn't default to "*"?
        this.db.select().from(parquetSql);
  }
}

export function duckDbTable<Table extends PgTableWithColumns<any>>(
  db: DuckDBDatabase,
  config: DuckDbStorageConfig<Table>,
): DuckDbTable<Table> {
  return new DuckDbTable(db, config);
}
