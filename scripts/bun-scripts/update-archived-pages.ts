import { sql, type SQL } from 'drizzle-orm';
import { load } from 'cheerio/slim';
import type { AnyBulkWriteOperation } from 'mongoose';
import { BlobStorageService } from '@dua-upd/blob-storage';
import { htmlSnapshotTable } from '@dua-upd/duckdb';
import { duckDbClient, getDb } from './deps';
import type { Page } from '@dua-upd/db';

async function remotePath() {
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

{
  await using db = await getDb();
  await using duckDb = await duckDbClient({
    memoryLimitMb: 1664,
    numThreads: 1,
  });

  const htmlSnapshotsPath = await remotePath();
  const latestSnapshotsPath = 'latest_snapshots.parquet';

  console.time('queryExecution');
  console.log('Executing query...');

  await duckDb.execute(`
    COPY (
      WITH latest_snapshots AS (
        SELECT *,
              ROW_NUMBER() OVER (PARTITION BY url ORDER BY date DESC) as row_num
        FROM '${htmlSnapshotsPath}'
      )
      SELECT *
        FROM latest_snapshots
        WHERE row_num = 1
    ) TO '${latestSnapshotsPath}'
    (FORMAT PARQUET, COMPRESSION zstd, ROW_GROUP_SIZE 4096);
  `);

  console.timeEnd('queryExecution');

  console.log(`Latest snapshots have been copied to ${latestSnapshotsPath}`);

  const archivedPagesUpdateOps: AnyBulkWriteOperation<Page>[] = [];

  let batchIndex = 0;
  let totalProcessed = 0;

  console.time('batchProcessing');
  const batchSize = 400;
  let offset = 0;

  while (true) {
    const rowBatch = await duckDb
      .select({
        url: htmlSnapshotTable.url,
        html: htmlSnapshotTable.html,
      })
      .from(
        sql.raw(
          `'${latestSnapshotsPath}'`,
        ) as unknown as typeof htmlSnapshotTable,
      )
      .offset(offset)
      .limit(batchSize);

    if (rowBatch.length === 0) break;

    for (const row of rowBatch) {
      const $ = load(row.html);
      const isArchived = !!$('.gc-archv').length;

      if (isArchived) {
        archivedPagesUpdateOps.push({
          updateOne: {
            filter: { url: row.url },
            update: { $set: { is_archived: true } },
          },
        });
      }
    }

    batchIndex++;
    totalProcessed += rowBatch.length;
    offset += batchSize;
    console.log(`Processed batch ${batchIndex}`);
  }
  console.timeEnd('batchProcessing');

  if (archivedPagesUpdateOps.length > 0) {
    await db.pages.bulkWrite(archivedPagesUpdateOps, { ordered: false });
  }

  console.log(
    `Finished processing all batches. Total processed ${totalProcessed}`,
  );

  const percentage = (archivedPagesUpdateOps.length / totalProcessed) * 100;

  console.log(
    `Found ${archivedPagesUpdateOps.length} archived pages | ~${percentage.toFixed(2)}% of all pages`,
  );
}
