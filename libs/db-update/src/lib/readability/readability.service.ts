import { ConsoleLogger, Inject, Injectable, Optional } from '@nestjs/common';
import { load } from 'cheerio/slim';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Types, mongo, type AnyBulkWriteOperation } from 'mongoose';
import { omit } from 'rambdax';
import stopwordsFr from 'stopwords-fr';
import stopwordsEn from 'stopwords-en';
import readability from 'text-readability';
import { BlobStorageService } from '@dua-upd/blob-storage';
import { DbService, Readability } from '@dua-upd/db';
import { BlobLogger } from '@dua-upd/logger';
import { md5Hash } from '@dua-upd/node-utils';
import { prettyJson, round, wait } from '@dua-upd/utils-common';
import type {
  DateRange,
  IPage,
  IReadability,
  ReadabilityScore,
} from '@dua-upd/types-common';
import { createUpdateQueue } from '../utils';
import { lexiqueLookup } from './utils';
import assert from 'node:assert';

dayjs.extend(utc);

@Injectable()
export class ReadabilityService {
  private readonly DATA_BLOB_NAME = 'readability-collection-data.json';
  private readonly logger: ConsoleLogger;

  constructor(
    private db: DbService,
    @Inject(BlobStorageService.name) private blobService: BlobStorageService,
    @Optional() @Inject('ENV') private production = false,
    @Optional() @Inject('DB_UPDATE_LOGGER') private blobLogger: BlobLogger,
    private defaultLogger: ConsoleLogger
  ) {
    if (this.blobLogger && !this.production) {
      this.blobLogger.disableBlobLogging();
    }

    this.logger = this.blobLogger || this.defaultLogger;
  }

  private async getCollectionBlobClient() {
    assert(this.blobService.blobModels.urls, 'Blob service not initialized');
    return this.blobService.blobModels.urls.blob(this.DATA_BLOB_NAME);
  }

  calculateReadability(content: string, lang: 'en' | 'fr'): ReadabilityScore {
    // remove <br> tags - they can cause issues where words are combined if there is no literal space between them
    const $ = load(content.replace(/<br\s?\/?>/g, ' '));

    $('style').remove();

    const main = $('main');
    const mainContent = main.text().replace('..', '.').replace('.', '. ');

    const preText = mainContent.replace(/[\n\t\r]/g, '');

    // add periods after bullet points and headings so that flesh kincaid considers them as sentences
    const html = load($.html().replace(/<\/(li|h[1-6]|p)>/g, '.$&'));

    html('table, div.pagedetails, #chat-bottom-bar').remove();

    const textContent = html('main').text();

    const postText = textContent
      .replace(/\.\./g, '. ')
      .replace(/(\.)\.\s/g, '$1')
      .replace(/\s+\.\s|\s+\.|(\.+)(?=$|\s)/g, '. ')
      .replace(/[\n\t\r]/g, '')
      .replace(/([.:;!?])\s*\./g, '$1 ')
      .replace(/\s+/g, ' ');

    const total_words = readability.lexiconCount(postText);

    const total_sentences = this.sentenceCount(postText);

    const total_syllables =
      lang === 'fr'
        ? this.syllableCountFr(postText)
        : readability.syllableCount(postText);

    const original_fk = this.calculateGradeLevel(
      preText,
      total_syllables,
      lang
    );

    const final_fk_score = this.calculateGradeLevel(
      postText,
      total_syllables,
      lang
    );

    // HTML string to be parsed
    const mainHtml = load(main.html() as string);

    // get all headings and calculate how many words on average between headings
    const headings = mainHtml('h1, h2, h3, h4, h5, h6');
    const total_headings = headings.length;
    const avg_words_per_header = total_headings
      ? round(total_words / total_headings, 2)
      : 0;

    // get all paragraphs and all bulleted list, and calculate how many words per paragraph on average
    const paragraphs = mainHtml('p, ul');
    const total_paragraph = paragraphs.length;
    const avg_words_per_paragraph = total_paragraph
      ? round(total_words / total_paragraph, 2)
      : 0;

    let fk_points: number;

    if (final_fk_score <= 6) fk_points = 60;
    else if (final_fk_score >= 18) fk_points = 0;
    else fk_points = round(60 - (final_fk_score - 6) * 5, 2);

    // calculate points for number of words between headings
    let header_points: number;
    if (avg_words_per_header <= 40) header_points = 20;
    else if (avg_words_per_header >= 200) header_points = 0;
    else header_points = round(20 - (avg_words_per_header - 40) * 0.125, 2);

    // calculate points for number of words per paragraph
    let paragraph_points: number;
    if (avg_words_per_paragraph <= 30) paragraph_points = 20;
    else if (avg_words_per_paragraph >= 80) paragraph_points = 0;
    else paragraph_points = round(20 - (avg_words_per_paragraph - 30) * 0.4, 2);

    // add all points
    const total_score = fk_points + header_points + paragraph_points;

    const words = this.removeStopwords(postText, lang);
    const wordCount = this.wordCount(words);

    const word_counts =
      Object.entries(wordCount)
        .sort(([wordA, countA], [wordB, countB]) => countB - countA)
        .slice(0, 20)
        .map(([word, count]) => ({ word, count })) || [];

    return {
      original_score: original_fk,
      final_fk_score,
      fk_points,
      avg_words_per_paragraph,
      avg_words_per_header,
      paragraph_points,
      header_points,
      word_counts,
      total_sentences,
      total_syllables,
      total_paragraph,
      total_headings,
      total_words,
      total_score,
    };
  }

  removeStopwords(text: string, lang: string): string[] {
    const words = text
      .toLocaleLowerCase(lang === 'fr' ? 'fr-CA' : 'en-CA')
      .replace(/’/g, "'")
      .replace(
        /[\u002D\u058A\u05BE\u2010\u2011\u2012\u2013\u2014\u2015\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g,
        '-'
      )
      .replace(/[ldjtscnm]'|[^A-zÀ-ú\-.0-9'’\s]/g, '')
      .replace(/\s+/g, ' ')
      .split(/[ -.]/)
      .filter((word) => word);

    const stopwords = new Set(lang === 'fr' ? stopwordsFr : stopwordsEn);

    return words.filter((word) => !stopwords.has(word));
  }

  wordCount(words: string[]) {
    const wordCount: { [key: string]: number } = {};

    for (const word of words.filter((word) => word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }

    return wordCount;
  }

  syllableCountFr(text: string): number {
    const words = text
      .toLocaleLowerCase('fr-CA')
      .replace(/’/g, "'")
      .replace(/[ldjtscnm]'|[^A-zÀ-ú\-'’\s]/g, '')
      .replace(/\s+/g, ' ')
      .split(' ');

    const notFound: string[] = [];

    return words.reduce((count, word) => {
      const entry = lexiqueLookup[word];
      if (entry !== undefined) {
        return count + entry;
      } else {
        notFound.push(word);
        return count;
      }
    }, 0);
  }

  calculateGradeLevel(text: string, syllables: number, lang: string): number {
    const word = readability.lexiconCount(text);
    const sentence = this.sentenceCount(text);
    const wordsPerSentence = word / sentence;
    const syllablesPerWord = syllables / word;

    if (lang === 'fr') {
      // Kandel-Moles reading ease formula
      return readability.fleschReadingEaseToGrade(
        207 - 1.015 * wordsPerSentence - 73.6 * syllablesPerWord
      );
    }

    // Flesch-Kincaid grade level formula
    return round(0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59, 1);
  }

  sentenceCount(text: string): number {
    return text.split(/[.!?]+\s/g).filter(Boolean).length;
  }

  lexiconCount(text: string): number {
    return (text.match(/(\w+)/g) || []).length;
  }

  async recalculateFromBlobStorage(
    dateRange?: DateRange<string>,
    uploadResults = this.production
  ) {
    const dateQuery = dateRange
      ? {
          date: {
            $gte: dayjs.utc(dateRange.start).toDate(),
            $lte: dayjs.utc(dateRange.end).toDate(),
          },
        }
      : {};

    const urlHashes = await this.db.collections.readability
      .find(dateQuery, {
        url: 1,
        hash: 1,
        date: 1,
        lang: 1,
      })
      .lean()
      .exec();

    type ErrorInfo = {
      url: string;
      hash: string;
      date: Date;
      error: string;
    };

    const updateQueue = createUpdateQueue<AnyBulkWriteOperation<IReadability>>(
      1000,
      async (ops) => {
        await this.db.collections.readability.bulkWrite(ops);
      }
    );

    // track various types of errors
    const networkErrors: ErrorInfo[] = [];
    const readabilityErrors: ErrorInfo[] = [];
    const missingBlobs: string[] = [];

    // Azure "hard" rate limit is 20k requests/second
    // that's probably much more than we can handle for calculating scores + db insertion.
    // So to be more efficient with memory, we'll do this in batches of 1000
    const batchSize = 1000;

    type ReadabilityData = {
      url: string;
      hash: string;
      date: Date;
      lang: 'en' | 'fr';
    };

    const processReadability = async ({
      url,
      hash,
      date,
      lang,
    }: ReadabilityData) => {
      assert(this.blobService.blobModels.urls, 'Blob service not initialized');

      const blob = this.blobService.blobModels.urls.blob(hash);

      if (!(await blob.exists())) {
        this.logger.warn(`blob does not exist for hash: ${hash}`);

        missingBlobs.push(hash);

        return;
      }

      const html = await blob.downloadToString().catch((err) => {
        this.logger.error(`Error downloading blob for hash: ${hash}\n${err}`);

        networkErrors.push({ url, hash, date, error: err.message });
      });

      if (!html) {
        return;
      }

      try {
        const score = this.calculateReadability(html as string, lang);

        await updateQueue.add({
          updateOne: {
            filter: { url, hash, date },
            update: { $set: { ...score } },
          },
        });
      } catch (err) {
        this.logger.error(
          'An error occurred while calculating readability or inserting results:\n' +
            `url: ${url}\n` +
            `hash: ${hash}\n` +
            err
        );

        readabilityErrors.push({ url, hash, date, error: err.message });
      }
    };

    while (urlHashes.length) {
      const batch = urlHashes.splice(0, batchSize);
      const promises: Promise<void>[] = [];

      for (const [i, readabilityData] of batch.entries()) {
        if (i % 16 === 0) {
          await wait(1);
        }

        promises.push(processReadability(readabilityData));
      }

      // Make sure our batch is done processing before moving on to the next
      await Promise.all(promises);
    }

    await updateQueue.flush();

    if (networkErrors.length) {
      console.log('network errors', networkErrors);
    }

    if (readabilityErrors.length) {
      console.log('readability errors', readabilityErrors);
    }

    if (missingBlobs.length) {
      console.log('missing blobs', missingBlobs);
    }

    if (uploadResults) {
      await this.saveCollectionToBlobStorage();
    }
  }

  async saveCollectionToBlobStorage() {
    const blobClient = await this.getCollectionBlobClient();

    const data = await this.db.collections.readability.find().lean().exec();

    if (!data) {
      this.logger.warn(
        'Tried to upload readability data, but collection is empty.'
      );

      return;
    }

    // hash data without any ObjectIds, because we can't depend on them staying the same
    const omitObjectIds = omit(['_id', 'page']);

    const hash = md5Hash(data.map((doc) => omitObjectIds(doc)));

    if (await blobClient.exists()) {
      // upload only if it has changed
      const blobMetadata = (await blobClient.getProperties()).metadata;

      if (blobMetadata?.hash === hash) {
        this.logger.log('Readability data in blob storage already up to date.');

        return;
      }
    }

    this.logger.log('Saving readability data to blob storage...');

    try {
      await blobClient.uploadFromString(JSON.stringify(data), {
        metadata: { date: new Date().toISOString(), hash },
        overwrite: true,
      });
    } catch (err) {
      this.logger.error(
        `Error uploading readability data to blob storage:\n${err}`
      );
    }

    this.logger.log('Readability data saved to blob storage.');
  }

  async updateCollectionFromBlobStorage() {
    const blobClient = await this.getCollectionBlobClient();

    if (!(await blobClient.exists())) {
      this.logger.warn(
        `Tried to sync local Readability collection, but data blob does not exist.`
      );
      return;
    }

    const currentData =
      (await this.db.collections.readability.find().lean().exec()) || [];

    // omit ObjectId fields to keep them from messing up the hash
    const omitObjectIds = omit(['_id', 'page']);

    const currentHash = md5Hash(currentData.map((doc) => omitObjectIds(doc)));

    const blobHash = (await blobClient.getProperties()).metadata?.hash;

    if (currentHash === blobHash) {
      this.logger.log(`Readability data already up to date.`);

      return;
    }

    this.logger.log(`Downloading Readability data from blob storage...`);

    try {
      const blobData = await blobClient.downloadToString();

      if (!blobData) {
        this.logger.warn(
          `Tried to sync local Readability collection, but data blob is empty.`
        );
        return;
      }

      this.logger.log(`Inserting data into collection...`);

      const jsonReviver = (key: string, value: string) => {
        if (key === 'date') {
          return new Date(value);
        }

        if (key === '_id' || key === 'page') {
          return new Types.ObjectId(value);
        }

        return value;
      };

      const omitObjectIdsAndDate = omit(['_id', 'date', 'page']);

      const bulkWriteOps: AnyBulkWriteOperation<Readability>[] = JSON.parse(
        blobData,
        jsonReviver
      ).map(
        (readability: Readability) =>
          ({
            updateOne: {
              filter: { url: readability.url, date: readability.date },
              update: {
                $setOnInsert: {
                  _id: readability._id,
                  page: readability.page,
                  date: readability.date,
                },
                $set: omitObjectIdsAndDate(readability),
              },
              upsert: true,
            },
          })
      );

      this.logger.log(`${bulkWriteOps.length} bulkWriteOps`);

      while (bulkWriteOps.length) {
        const batch = bulkWriteOps.splice(0, 1000);

        const bulkWriteResults =
          await this.db.collections.readability.bulkWrite(batch, {
            ordered: false,
          });

        if (bulkWriteResults.modifiedCount) {
          this.logger.log(
            `${bulkWriteResults.modifiedCount} readability docs updated.`
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Error updating readability collection from blob storage:\n${err}`
      );
    }

    await this.ensurePageRefs();
  }

  async ensurePageRefs() {
    this.logger.log('Ensuring page refs for readability collection...');

    const readabilityWithPages = await this.db.collections.readability
      .aggregate<{ _id: Types.ObjectId; url: string; page?: [IPage] }>()
      .project({ url: 1, page: 1 })
      .match({ page: { $exists: true } })
      .lookup({
        from: 'pages',
        localField: 'page',
        foreignField: '_id',
        as: 'page',
      })
      .exec();

    const urlsToUpdate = readabilityWithPages
      .filter(
        (readabilityDoc) =>
          !readabilityDoc.page?.length ||
          readabilityDoc.page[0].url !== readabilityDoc.url
      )
      .map(({ url }) => url);

    if (!urlsToUpdate.length) {
      this.logger.log('Pages references are up to date.');

      return;
    }

    const pagesForUpdates = await this.db.collections.pages
      .find({ url: { $in: urlsToUpdate } })
      .lean()
      .exec();

    if (!pagesForUpdates.length) {
      this.logger.error(
        `Invalid references found, but no corresponding pages were found for urls: ${prettyJson(
          urlsToUpdate
        )}`
      );

      return;
    }

    const bulkWriteOps: AnyBulkWriteOperation<IReadability>[] =
      pagesForUpdates.map((page) => ({
        updateMany: {
          filter: { url: page.url },
          update: {
            $set: { page: page._id },
          },
        },
      }));

    this.logger.log(
      `Updating references to ${pagesForUpdates.length} pages...`
    );

    await this.db.collections.readability.bulkWrite(bulkWriteOps);

    this.logger.log('Page references successfully updated.');

    return;
  }
}
