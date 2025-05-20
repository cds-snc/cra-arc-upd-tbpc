import { ConsoleLogger, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, AnyBulkWriteOperation } from 'mongoose';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import type { PageDocument } from '@dua-upd/db';
import { Page } from '@dua-upd/db';

dayjs.extend(duration);

@Injectable()
export class PageUpdateService {
  constructor(
    private logger: ConsoleLogger,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
  ) {}

  async updatePagesLang() {
    this.logger.log('Ensuring all pages have a `lang` property...');

    const pagesToUpdate = await this.pageModel
      .find({
        url: /^www\.canada\.ca\//i,
        $or: [
          { lang: { $exists: false } },
          { $and: [{ lang: { $ne: 'en' } }, { lang: { $ne: 'fr' } }] },
        ],
      })
      .lean()
      .exec();

    if (!pagesToUpdate.length) {
      this.logger.log('All pages already have a `lang` property.');
      return;
    }

    this.logger.log(`Setting lang for ${pagesToUpdate.length} pages...`);

    const bulkWriteOps: AnyBulkWriteOperation<Page>[] = pagesToUpdate
      .map(({ _id, url }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $set: {
              lang: url.match(/^www\.canada\.ca\/(en|fr)\//i)?.[1],
            } as { lang?: 'en' | 'fr' },
          },
        },
      }))
      .filter(({ updateOne: { update } }) => update.$set.lang);

    await this.pageModel.bulkWrite(bulkWriteOps);

    this.logger.log(`Successfully updated ${pagesToUpdate.length} pages.`);
  }
}
