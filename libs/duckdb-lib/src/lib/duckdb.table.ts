import { sql, type SQLWrapper, type DrizzleTypeError } from 'drizzle-orm';
import {
  type PgInsertValue,
  type PgTableWithColumns,
  type SelectedFields,
  type TableLikeHasEmptySelection,
} from 'drizzle-orm/pg-core';
import type { DuckDBDatabase } from '@duckdbfan/drizzle-duckdb';
import type { BlobStorageService } from '@dua-upd/blob-storage';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { availableParallelism } from 'node:os';

export type DuckDbStorageConfig<Table extends PgTableWithColumns<any>> = {
  name: string;
  table: Table;
  tableCreationSql: SQLWrapper | string;
  remoteContainer: string;
  remoteContainerPath: string;
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
  readonly remoteContainer: string;
  readonly remoteContainerPath: string;
  readonly remotePath: string;
  readonly remoteBackupPath: string;
  readonly fullRemotePath: string;

  constructor(
    private readonly db: DuckDBDatabase,
    private readonly blob: BlobStorageService,
    private readonly config: DuckDbStorageConfig<Table>,
  ) {
    this.name = config.name;
    this.table = config.table;
    this.remoteContainer = config.remoteContainer;
    this.remoteContainerPath = config.remoteContainerPath;
    this.remotePath = `${config.remoteContainer}/${config.remoteContainerPath}`;
    this.remoteBackupPath = `${config.remoteContainer}/backup/${config.remoteContainerPath}`;
    this.fullRemotePath = `${getStorageUriPrefix()}${this.remotePath}`;
    this.filename =
      this.remoteContainerPath.split('/').pop() || this.remoteContainerPath;
  }

  async backupRemote() {
    const container = await this.blob.container(this.remoteContainer);

    const backupFilePath = this.remoteBackupPath.replace(
      /\.parquet$/,
      `_${new Date().toISOString().slice(0, 10)}.parquet`,
    );
    console.log(`Backing up ${this.remotePath} to ${backupFilePath}`);

    const blobClient = container
      ?.createBlobsClient({
        overwrite: true,
        path: this.remoteContainer,
      })
      .blob(this.remoteContainerPath);
    const backupBlobClient = container
      ?.createBlobsClient({
        overwrite: true,
        path: this.remoteContainer,
      })
      .blob(backupFilePath);

    if (!blobClient?.url) {
      throw new Error(`Blob client for ${this.remotePath} not found`);
    }

    await backupBlobClient?.copyFromUrl(blobClient?.url);

    console.log(`Backup complete: ${this.remoteBackupPath}`);
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
    await this.blob.blobModels.html_snapshots
      ?.blob(this.filename)
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

    const container = await this.blob.container(this.remoteContainer);
    if (!container) {
      throw new Error(`Container ${this.remoteContainer} not found`);
    }

    const storageClient = container
      .createBlobsClient({
        overwrite: true,
        path: this.remoteContainer,
      })
      .blob(this.remoteContainerPath);

    await storageClient?.uploadStream(
      createReadStream(this.filename, {
        highWaterMark: uploadStreamBufferSize,
      }),
    );

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
    const parquetSql = sql.raw(
      `read_parquet('${this.fullRemotePath}') as "${this.name}"`,
    ) as unknown as DrizzleTable<Table>;

    return selection
      ? this.db.select(selection).from(parquetSql)
      : // bug in drizzle-duckdb where empty select doesn't default to "*"?
        this.db.select().from(parquetSql);
  }
}

export function duckDbTable<Table extends PgTableWithColumns<any>>(
  db: DuckDBDatabase,
  blob: BlobStorageService,
  config: DuckDbStorageConfig<Table>,
): DuckDbTable<Table> {
  return new DuckDbTable(db, blob, config);
}
