import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { gunzip } from '@dua-upd/node-utils';
import type { DuckDBDatabase } from '@duckdbfan/drizzle-duckdb';
import type { ParquetWriteOptions } from './duckdb.table';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export class DuckDbExtensionsManager {
  constructor(private readonly db: DuckDBDatabase) {}

  async getPlatform() {
    const [{ platform }] = await this.db.execute('PRAGMA platform;');
    return platform as string;
  }

  async getVersion() {
    const [{ library_version: version }] =
      await this.db.execute('PRAGMA version;');
    return version as string;
  }

  async getExtensionsDirectory(platform: string, version: string) {
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'];

    if (!homeDir) {
      throw new Error(
        'Home directory not found. Please set HOME or USERPROFILE.',
      );
    }

    return path.join(homeDir, '.duckdb', 'extensions', version, platform);
  }

  async downloadExtension(name: string) {
    const platform = await this.getPlatform();
    const version = await this.getVersion();
    const extensionsDir = await this.getExtensionsDirectory(platform, version);

    const extPath = path.join(extensionsDir, `${name}.duckdb_extension`);

    if (existsSync(extPath)) {
      console.log(
        `Extension ${name} already exists at ${extPath}, skipping download.`,
      );
      return extPath;
    }

    const url = `https://extensions.duckdb.org/${version}/${platform}/${name}.duckdb_extension.gz`;

    console.log(`Downloading extension ${name} from ${url}...`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download extension: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const unzippedBuffer = await gunzip(Buffer.from(buffer));

    const extDir = path.dirname(extPath);

    if (!existsSync(extDir)) {
      await mkdir(extDir, { recursive: true });
    }

    await writeFile(extPath, unzippedBuffer);
    console.log(`Extension ${name} downloaded to ${extPath}`);

    return extPath;
  }

  async installExtension(name: string) {
    const extPath = await this.downloadExtension(name);

    console.log(`Installing extension ${name} from ${extPath}...`);

    try {
      await this.db.execute(`FORCE INSTALL '${extPath}';`);
      console.log(`${name} extension installed successfully.`);

      await this.db.execute(`LOAD ${name};`);
      console.log(`${name} extension loaded successfully.`);
    } catch (error) {
      console.error(`Error installing ${name} extension:`, error);
    }
  }
}

export function writeParquetOptionsToSql<Table extends PgTableWithColumns<any>>(
  options?: ParquetWriteOptions<Table>,
) {
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

  return sql.raw(`FORMAT parquet, COMPRESSION zstd, ${optionsSql}`);
}
