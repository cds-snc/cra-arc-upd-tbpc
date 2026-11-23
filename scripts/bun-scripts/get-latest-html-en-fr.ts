import { BlobStorageService } from '@dua-upd/blob-storage';
import { duckDbClient } from './deps';
import { DuckDbExtensionsManager } from '@dua-upd/duckdb';
import { sql, count } from 'drizzle-orm';

/*
HTML snapshots schema:
url TEXT,
page TEXT,
hash TEXT,
html TEXT,
date TIMESTAMP
*/
async function htmlSnapshotsRemotePath() {
  const filename = 'hashes-html.parquet';
  const blobService = await BlobStorageService.init(
    process.env['STORAGE_URI_PREFIX'] === 'az://' ? 'azure' : 's3',
  );

  const htmlSnapshotsBlob = blobService.blobModels.html_snapshots!;
  const container = `${htmlSnapshotsBlob.getContainer().containerName}/`;

  const storagePath = htmlSnapshotsBlob.getPath().replace(/\/$/, ''); // Remove trailing slash if present

  const filePath = `${storagePath}/${filename}`;

  return `${process.env['STORAGE_URI_PREFIX']}${container}${filePath}`;
}

function dataRemotePath(filename: string) {
  const prefix = process.env['STORAGE_URI_PREFIX'];
  const container = process.env['DATA_BUCKET_NAME'] ?? 'data';
  return `${prefix}${container}/data/${filename}`;
}

{
  await using duckDb = await duckDbClient();
  await new DuckDbExtensionsManager(duckDb).installExtension('excel');

  const htmlSnapshotsPath = await htmlSnapshotsRemotePath();
  const outputFilename = 'html_comparison';

  console.time('queryExecution');
  console.log('Executing query...');

  await duckDb.execute(`
    COPY (
      WITH urls AS (
        SELECT url, last_checked, list_max(list_transform(hashes, x -> x.date)) AS last_modified
        FROM read_parquet('${dataRemotePath('urls.parquet')}')
      ), pages AS (
        SELECT p.url, p.lang, p.altLangHref, u.last_checked, u.last_modified
        FROM read_parquet('${dataRemotePath('pages.parquet')}') p
        LEFT JOIN urls u ON p.url = u.url
        WHERE p.is_archived IS NOT TRUE
          AND p.is_404 IS NOT TRUE
          AND NULLIF(TRIM(p.redirect), '') IS NULL
          AND p.lang IN ('en', 'fr')
      ), latest_snapshots AS (
        SELECT url, html
        FROM read_parquet('${htmlSnapshotsPath}')
        WHERE url IN (SELECT url FROM pages)
        QUALIFY ROW_NUMBER() OVER (PARTITION BY url ORDER BY date DESC) = 1
      ), page_snapshots AS (
        SELECT p.*, regexp_replace(s.html, '[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]', '', 'g') AS html -- Remove bad control characters from HTML
        FROM pages p
        LEFT JOIN latest_snapshots s ON p.url = s.url
      ), en AS (
        SELECT url AS url_en, html AS html_en,
               last_modified::DATE AS last_updated_en, last_checked::DATE AS last_checked_en
        FROM page_snapshots
        WHERE lang = 'en'
      ), fr AS (
        SELECT url AS url_fr, html AS html_fr, altLangHref,
               last_modified::DATE AS last_updated_fr, last_checked::DATE AS last_checked_fr
        FROM page_snapshots
        WHERE lang = 'fr'
      ), joined AS (
        SELECT en.*, fr.* EXCLUDE (altLangHref),
               last_updated_en = last_updated_fr AS same_last_updated,
               last_checked_en = last_checked_fr AS same_last_checked
        FROM en
        JOIN fr ON fr.altLangHref = en.url_en
      )
      SELECT *,
             COALESCE(NOT same_last_updated, NOT same_last_checked, FALSE) AS has_diff,
             ABS(last_updated_en - last_updated_fr) AS last_updated_days_difference
      FROM joined
    ) TO '${outputFilename}.parquet'
    (FORMAT PARQUET, COMPRESSION zstd, COMPRESSION_LEVEL 7, ROW_GROUP_SIZE 4092);
  `);

  console.timeEnd('queryExecution');
  console.log(
    `English/French snapshot comparisons have been copied to ${outputFilename}.parquet`,
  );

  console.log('Exporting Excel file');

  const [{ numRows }] = await duckDb
    .select({ numRows: count() })
    .from(sql.raw(`read_parquet('${outputFilename}.parquet')`));

  console.log(`Number of rows in ${outputFilename}.parquet: ${numRows}`);

  // Export Excel files with capped number of rows:
  const maxRowsPerExcelFile = 4000;

  const numExcelFiles = Math.ceil(numRows / maxRowsPerExcelFile);

  console.log(`Number of Excel files to be generated: ${numExcelFiles}`);

  for (let i = 0; i < numExcelFiles; i++) {
    const offset = i * maxRowsPerExcelFile;
    const limit = maxRowsPerExcelFile;
    const excelFilename = `${outputFilename}_${i + 1}.xlsx`;

    console.time(`excelExport_${i + 1}`);
    await duckDb.execute(`
      COPY (SELECT * FROM read_parquet('${outputFilename}.parquet') LIMIT ${limit} OFFSET ${offset})
      TO '${excelFilename}'
      (FORMAT XLSX, HEADER TRUE);
    `);
    console.timeEnd(`excelExport_${i + 1}`);
    console.log(
      `English/French snapshot comparisons have been exported to ${excelFilename}`,
    );
  }
}
