import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { UrlHash } from '@dua-upd/types-common';
import { AsyncLogTiming } from '@dua-upd/utils-common';
import { format } from 'prettier';
import { DuckDbService } from '@dua-upd/duckdb';
import { DbService } from '@dua-upd/db';
import { Types } from 'mongoose';

@Injectable()
export class HashesService {
  constructor(
    @Inject(DbService)
    private db: DbService,
    @Inject(DuckDbService.name)
    private duckDb: DuckDbService,
  ) {}

  @AsyncLogTiming
  async getHashes(id: string): Promise<UrlHash[]> {
    const pageUrl = (
      await this.db.collections.pages
        .findById(new Types.ObjectId(id), { url: 1 })
        .lean()
        .exec()
    )?.url;

    if (!pageUrl) {
      throw Error(`Page not found for for id ${id}`);
    }

    const htmlTable = this.duckDb.remote.html.table;

    const hashes = await this.duckDb.remote.html
      .selectRemote({
        hash: htmlTable.hash,
        date: htmlTable.date,
        html: htmlTable.html,
      })
      .where(eq(htmlTable.url, pageUrl))
      .orderBy(desc(htmlTable.date))
      .execute()
      .then(async (rows) =>
        Promise.allSettled(
          rows.map(async ({ hash, date, html }) => ({
            hash: hash || '',
            date: date || new Date(date || 0),
            blob: await format(html || '', { parser: 'html' }),
          })),
        ),
      )
      .then((results) =>
        results
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value),
      );

    return hashes;
  }
}
