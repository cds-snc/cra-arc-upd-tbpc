import { QueryFilter, Types } from 'mongoose';
import { DbService, Overall } from '@dua-upd/db';
import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { AirtableClient } from '../lib/airtable';
import { CreatedFieldRecord, Lang } from '../lib/airtable/query';
import { squishTrim } from '@dua-upd/utils-common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { NotifyClient } from 'notifications-node-client';

dayjs.extend(utc);

type NotInList = { term: string; url: string };

export interface TopSearchPages {
  term: string;
  url_positions: { url: string; position: number; clicks: number }[];
}

@Injectable()
export class SearchAssessmentService {
  constructor(
    @Inject(AirtableClient.name) private airtableClient: AirtableClient,
    private db: DbService,
    private logger: ConsoleLogger
  ) {}

  craEn = 'https://www.canada.ca/en/revenue-agency/search.html';
  craFr = 'https://www.canada.ca/fr/agence-revenu/rechercher.html';

  async email(lang: 'en' | 'fr', notInList: NotInList[], date: string) {
    const templateId =
      lang === 'en'
        ? process.env['NOTIFY_TEMPLATE_ID_EN']
        : process.env['NOTIFY_TEMPLATE_ID_FR'];

    const client = new NotifyClient(
      'https://api.notification.canada.ca',
      process.env['NOTIFY_API_KEY']
    );

    const emails = [process.env['NOTIFY_EMAIL'], process.env['NOTIFY_EMAIL_2']];

    this.logger.log(
      `Sending email to ${emails.length} recipients for ${lang}...`
    );

    for (const email of emails) {
      await client.sendEmail(templateId, email, {
        personalisation: {
          first_name: 'DUA',
          number: `**${notInList.length}**`,
          bulleted_list: notInList.map(
            (d) => `**${d.term}** : https://${d.url}`
          ),
          date: date,
        },
      });
    }
  }

  async upsertPreviousSearchAssessment() {
    for (const lang of ['en', 'fr'] as ('en' | 'fr')[]) {
      const records = await this.getCurrentSearchAssessment(lang);
      const dbStartQuery = await this.db.collections.searchAssessment
        .find({ lang: lang }, { date: 1 })
        .sort({ date: -1 })
        .limit(1)
        .exec();
      let startDate = dayjs
        .utc(records[0]?.fields.Date || '2022-11-13')
        .startOf('day');
      const dbStartDate = dayjs
        .utc(dbStartQuery[0]?.date || '2022-11-12')
        .startOf('day');

      const cutoffDate = dayjs
        .utc()
        .subtract(2, 'week')
        .endOf('week')
        .startOf('day');

      let endDate = dayjs
        .utc(startDate)
        .add(1, 'week')
        .subtract(1, 'day')
        .startOf('day');

      let flag = 0;

      this.logger.log(
        `Updating previous week's search assessment for ${lang} from ${startDate} to ${endDate}`
      );

      while (startDate.isBefore(cutoffDate) && startDate.isAfter(dbStartDate)) {
        flag = 1;
        const dateRangeFilter = {
          date: {
            $gte: new Date(startDate.format('YYYY-MM-DD')),
            $lte: new Date(endDate.format('YYYY-MM-DD')),
          },
        };

        let expectedResultsMaster = await this.getExpectedResultsMaster(lang);
        const dbOverallResults = await this.getTopSearchFromOverall(
          lang,
          dateRangeFilter
        );
        const topSearchPages = await this.getTopSearchTermPages(
          lang,
          dateRangeFilter,
          dbOverallResults
        );

        const blankExpectedUrlCount = records.filter(
          (d) => d.fields['Expected Result'] === undefined
        ).length;

        const termsNotInExpectedDB = records
          .map((d, idx) => {
            const result = expectedResultsMaster.find(
              (r) =>
                squishTrim(r.fields.Query.toLowerCase()) ===
                squishTrim(d.fields.Query.toLowerCase())
            );
            const sorted = topSearchPages
              .find((r) => r.term === d.fields.Query)
              ?.url_positions.sort((a, b) => a.position - b.position);
            const expectedUrl = records[idx]?.fields['Expected Result'];
            const expectedUrlStartsWithWWW = expectedUrl?.startsWith('www.');
            const sortedUrl = sorted?.[0]?.url.startsWith('www.')
              ? `https://${sorted?.[0].url}`
              : '';

              if (!result) {
                return {
                  fields: {
                    Query: d.fields.Query,
                    URL: expectedUrlStartsWithWWW
                      ? `https://${expectedUrl}`
                      : expectedUrl || sortedUrl,
                  },
                };
              }

            return undefined;
          })
          .flatMap((f) => (f ? [f] : []))
          .flat();

        if (
          termsNotInExpectedDB.length > 0 ||
          blankExpectedUrlCount > 0 ||
          records.length === 0
        ) {
          this.logger.log(
            `Found ${termsNotInExpectedDB.length} term(s) not in the Expected DB Master List, or ${blankExpectedUrlCount} blank Expected Result(s)`
          );
          this.logger.log(`Updating the list...`);
          await this.insertExpectedDB(termsNotInExpectedDB, lang);

          expectedResultsMaster = await this.getExpectedResultsMaster(lang);

          const expectedResultsMerged = await this.getExpectedResultsMerged(
            topSearchPages,
            expectedResultsMaster
          );

          const notInList: NotInList[] = [];

          const airtableInput = topSearchPages.map(
            ({ term, url_positions }) => {
              const sorted = url_positions.sort(
                (a, b) => a.position - b.position
              );
              const expected = expectedResultsMerged.find(
                (r) => r?.term === term
              );
              const foundClicks = dbOverallResults.find((t) => t._id === term);
              const expectedUrlClicks = topSearchPages.find(
                (result) => result.term === term
              );
              const expectedUrlClicksSum = expectedUrlClicks?.url_positions
                .filter(
                  (url) =>
                    `https://${url.url}` ===
                    expectedResultsMerged.find(
                      (item) => item?.term === expectedUrlClicks?.term
                    )?.url
                )
                .map((url) => url.clicks)
                .reduce((a, b) => a + b, 0);

              if (!expected?.url) {
                notInList.push({
                  term,
                  url: sorted[0]?.url || '',
                });
              }

              return {
                fields: {
                  Query: term,
                  'Expected Result': expected?.url || '',
                  'Expected Position':
                    Math.round(expected?.position as number) || 0,
                  Pass: expected?.position && +expected?.position <= 3 ? true : false,
                  '1st Result': sorted[0]?.url || '',
                  '1st Position': sorted[0]?.position || 0,
                  '2nd Result': sorted[1]?.url || '',
                  '2nd Position': sorted[1]?.position || 0,
                  '3rd Result': sorted[2]?.url || '',
                  '3rd Position': sorted[2]?.position || 0,
                  '4th Result': sorted[3]?.url || '',
                  '4th Position': sorted[3]?.position || 0,
                  '5th Result': sorted[4]?.url || '',
                  '5th Position': sorted[4]?.position || 0,
                  Date: startDate.format('YYYY-MM-DD'),
                  'Total searches': foundClicks?.num_searches || 0,
                  'Total clicks': foundClicks?.clicks || 0,
                  'Target clicks': expectedUrlClicksSum || 0,
                },
              };
            }
          );

          await this.deleteSearchAssessment(lang);
          await this.insertCurrentSearchAssessment(airtableInput, lang);
        }

        this.logger.log(`Upserting previous weeks data...`);
        await this.archiveSearchAssessmentData(lang);

        startDate = startDate.add(1, 'week');
        endDate = endDate.add(1, 'week');
      }

      if (!flag) {
        this.logger.log(`No new records to update for ${lang}`);
      }
    }
  }

  async placeSearchAssessment() {
    for (const lang of ['en', 'fr'] as ('en' | 'fr')[]) {
      const records = (await this.getCurrentSearchAssessment(lang)).sort(
        (a, b) => b.fields.Date.localeCompare(a.fields.Date)
      );
      const dbStartQuery = await this.db.collections.searchAssessment
        .find({ lang: lang }, { date: 1 })
        .sort({ date: -1 })
        .limit(1)
        .exec();
      let startDate = dayjs
        .utc(records[0]?.fields.Date || '2022-11-13')
        .startOf('day');
      const dbStartDate = dayjs
        .utc(dbStartQuery[0]?.date || '2022-11-12')
        .startOf('day');

      const cutoffDate = dayjs
        .utc()
        .subtract(1, 'week')
        .endOf('week')
        .startOf('day');

      let endDate = dayjs
        .utc(startDate)
        .add(1, 'week')
        .subtract(1, 'day')
        .startOf('day');

      let flag = 0;

      this.logger.log(
        `Updating previous week's search assessment for ${lang} from ${startDate} to ${endDate}`
      );

      while (startDate.isBefore(cutoffDate)) {
        flag = 1;
        const dateRangeFilter = {
          date: {
            $gte: new Date(startDate.format('YYYY-MM-DD')),
            $lte: new Date(endDate.format('YYYY-MM-DD')),
          },
        };
        flag = 1;

        const notInList: NotInList[] = [];

        const dbOverallResults = await this.getTopSearchFromOverall(
          lang,
          dateRangeFilter
        );
        const dbRecords = await this.getTopSearchTermPages(
          lang,
          dateRangeFilter,
          dbOverallResults
        );
        const expectedResultsMaster = await this.getExpectedResultsMaster(lang);
        const expectedResultsMerged = await this.getExpectedResultsMerged(
          dbRecords,
          expectedResultsMaster
        );

        const airtableInput = dbRecords.map(({ term, url_positions }) => {
          const sorted = url_positions.sort((a, b) => a.position - b.position);
          const expected = expectedResultsMerged.find((r) => r?.term === term);
          const foundClicks = dbOverallResults.find((t) => t._id === term);
          const expectedUrlClicks = dbRecords.find(
            (result) => result.term === term
          );
          const expectedUrlClicksSum = expectedUrlClicks?.url_positions
            .filter(
              (url) =>
                `https://${url.url}` ===
                expectedResultsMerged.find(
                  (item) => item?.term === expectedUrlClicks?.term
                )?.url
            )
            .map((url) => url.clicks)
            .reduce((a, b) => a + b, 0);

          if (expected?.position === 0 && !expected?.url) {
            notInList.push({
              term,
              url: sorted[0]?.url || '',
            });
          }

          return {
            fields: {
              Query: term,
              'Expected Result': expected?.url || '',
              'Expected Position':
                Math.round(expected?.position as number) || 0,
              Pass: expected?.position && +expected.position <= 3 ? true : false,
              '1st Result': sorted[0]?.url || '',
              '1st Position': sorted[0]?.position || 0,
              '2nd Result': sorted[1]?.url || '',
              '2nd Position': sorted[1]?.position || 0,
              '3rd Result': sorted[2]?.url || '',
              '3rd Position': sorted[2]?.position || 0,
              '4th Result': sorted[3]?.url || '',
              '4th Position': sorted[3]?.position || 0,
              '5th Result': sorted[4]?.url || '',
              '5th Position': sorted[4]?.position || 0,
              Date: startDate.format('YYYY-MM-DD'),
              'Total searches': foundClicks?.num_searches || 0,
              'Total clicks': foundClicks?.clicks || 0,
              'Target clicks': expectedUrlClicksSum || 0,
            },
          };
        });
        await this.airtableClient.insertSearchAssessment(airtableInput, lang);
        startDate = startDate.add(1, 'week');
        endDate = endDate.add(1, 'week');
      }

      if (!flag) {
        this.logger.log(`No new records to update for ${lang}`);
      }
    }
  }

  async getLatestSearchAssessment() {
    for (const lang of ['en', 'fr'] as ('en' | 'fr')[]) {
      const records = (await this.getCurrentSearchAssessment(lang))
        .sort((a, b) => b.fields.Date?.localeCompare(a.fields.Date || '') || 0);

      const atStartDate = dayjs.utc(records[0]?.fields.Date);

      const dbStartQuery = await this.db.collections.searchAssessment
        .find({ lang: lang }, { date: 1 })
        .sort({ date: -1 })
        .limit(1)
        .exec();

      const dbStartDate = dayjs.utc(dbStartQuery[0]?.date).startOf('day');

      const cutoffDate = dayjs
        .utc()
        .subtract(3, 'week')
        .endOf('week')
        .add(1, 'day')
        .startOf('day');

      const startDate = dbStartDate.add(1, 'week').startOf('week');
      const endDate = dbStartDate.add(1, 'week').endOf('week').startOf('day');

      const dateRangeFilter = {
        date: {
          $gte: new Date(startDate.format('YYYY-MM-DD')),
          $lte: new Date(endDate.format('YYYY-MM-DD')),
        },
      };

      this.logger.log(
        `Getting latest search assessment for ${lang} from ${startDate} to ${endDate}`
      );

      let flag = 0;

      if (atStartDate.isSameOrBefore(cutoffDate)) {
        flag = 1;

        const notInList: NotInList[] = [];

        const dbOverallResults = await this.getTopSearchFromOverall(
          lang,
          dateRangeFilter
        );
        const dbRecords = await this.getTopSearchTermPages(
          lang,
          dateRangeFilter,
          dbOverallResults
        );
        const expectedResultsMaster = await this.getExpectedResultsMaster(lang);
        const expectedResultsMerged = await this.getExpectedResultsMerged(
          dbRecords,
          expectedResultsMaster
        );

        const airtableInput = dbRecords.map(({ term, url_positions }) => {
          const sorted = url_positions.sort((a, b) => a.position - b.position);
          const expected = expectedResultsMerged.find((r) => r?.term === term);
          const foundClicks = dbOverallResults.find((t) => t._id === term);
          const expectedUrlClicks = dbRecords.find(
            (result) => result.term === term
          );
          const expectedUrlClicksSum = expectedUrlClicks?.url_positions
            .filter(
              (url) =>
                `https://${url.url}` ===
                expectedResultsMerged.find(
                  (item) => item?.term === expectedUrlClicks?.term
                )?.url
            )
            .map((url) => url.clicks)
            .reduce((a, b) => a + b, 0);

          if (expected?.position === 0 && !expected?.url) {
            notInList.push({
              term,
              url: sorted[0]?.url || '',
            });
          }

          return {
            fields: {
              Query: term,
              'Expected Result': expected?.url || '',
              'Expected Position':
                Math.round(expected?.position as number) || 0,
              Pass:
                expected?.position &&
                +expected.position <= 3 &&
                expected?.position !== 0  ? true : false,
              '1st Result': sorted[0]?.url || '',
              '1st Position': sorted[0]?.position || 0,
              '2nd Result': sorted[1]?.url || '',
              '2nd Position': sorted[1]?.position || 0,
              '3rd Result': sorted[2]?.url || '',
              '3rd Position': sorted[2]?.position || 0,
              '4th Result': sorted[3]?.url || '',
              '4th Position': sorted[3]?.position || 0,
              '5th Result': sorted[4]?.url || '',
              '5th Position': sorted[4]?.position || 0,
              Date: startDate.format('YYYY-MM-DD'),
              'Total searches': foundClicks?.num_searches || 0,
              'Total clicks': foundClicks?.clicks || 0,
              'Target clicks': expectedUrlClicksSum || 0,
            },
          };
        });

        await this.deleteSearchAssessment(lang);
        await this.airtableClient.insertSearchAssessment(airtableInput, lang);

        if (notInList.length !== 0) {
          this.logger.log(
            `Found ${notInList.length} terms not in the list for ${lang}; sending email to recipients...`
          );
          await this.email(
            lang,
            notInList,
            endDate.add(1, 'week').format('YYYY-MM-DD')
          );
        }
      }

      if (!flag) {
        this.logger.log(`No new records to update for ${lang}`);
      }
    }
  }

  async getExpectedResultsMerged(
    dbRecords: TopSearchPages[],
    expectedResults: { fields: { Id: string; Query: string; URL: string } }[]
  ) {
    return dbRecords
      .map((record) => {
        let found = 0;
        const result = expectedResults.find(
          (r) =>
            squishTrim(r.fields.Query.toLowerCase()) ===
            squishTrim(record.term.toLowerCase())
        );

        if (result) {
          const expected = record.url_positions.map((u) => {
            const expectedUrl = result?.fields?.URL || '';
            const expectedUrlMatch = expectedUrl?.includes(u.url);
            const expectedUrlStartsWithWWW = expectedUrl?.startsWith('www.');

            if (expectedUrlMatch) {
              found = 1;
              return {
                term: record.term,
                url: expectedUrlStartsWithWWW
                  ? `https://${expectedUrl}`
                  : expectedUrl,
                position: u.position,
              };
            }

            return undefined;
          });

          if (found === 0) {
            return {
              term: record.term,
              url: result?.fields?.URL || '',
              position: 0,
            };
          }

          return expected.filter((e) => e !== undefined);
        }

        return {
          term: record.term,
          url: '',
          position: 0,
        };
      })
      .flatMap((f) => (f ? [f] : []))
      .flat();
  }

  async getTopSearchFromOverall(
    lang: 'en' | 'fr',
    dateRange: QueryFilter<Overall>
  ) {
    const searchTermSelector =
      lang === 'en' ? 'aa_searchterms_en' : 'aa_searchterms_fr';

    const topSearchTermsResults = await this.db.collections.overall
      .aggregate<{ _id: string; clicks: number; num_searches: number }>()
      .match(dateRange)
      .project({
        date: 1,
        aa_searchterms_en: 1,
        aa_searchterms_fr: 1,
      })
      .unwind(`${searchTermSelector}`)
      .project({
        date: 1,
        term: {
          $toLower: `$${searchTermSelector}.term`,
        },
        clicks: `$${searchTermSelector}.clicks`,
        num_searches: `$${searchTermSelector}.num_searches`,
      })
      // first group terms that were different cases and take the sum of their clicks
      .group({
        _id: {
          date: '$date',
          term: '$term',
        },
        clicks: {
          $sum: '$clicks',
        },
        num_searches: {
          $sum: '$num_searches',
        },
      })
      .group({
        _id: '$_id.term',
        clicks: {
          $sum: '$clicks',
        },
        num_searches: {
          $sum: '$num_searches',
        },
      })
      .sort({ num_searches: -1, _id: 1 })
      .limit(100)
      .exec();

    return topSearchTermsResults;
  }

  async getTopSearchTermPages(
    lang: 'en' | 'fr',
    dateRange: QueryFilter<Overall>,
    data: { _id: string; clicks: number; num_searches: number }[]
  ) {
    const topSearchTerms = data.map((result) => result._id);

    return await this.db.collections.pageMetrics
      .aggregate<TopSearchPages>()
      .project({
        date: 1,
        url: 1,
        aa_searchterms: {
          $map: {
            input: '$aa_searchterms',
            as: 'searchterm',
            in: {
              term: {
                $toLower: '$$searchterm.term',
              },
              clicks: '$$searchterm.clicks',
              position: '$$searchterm.position',
            },
          },
        },
      })
      .match({
        ...dateRange,
        url: new RegExp(`^www\\.canada\\.ca/${lang}/`),
        'aa_searchterms.term': {
          $in: topSearchTerms,
        },
      })
      .project({
        url: 1,
        aa_searchterms: {
          $filter: {
            input: '$aa_searchterms',
            as: 'searchterm',
            cond: {
              $in: ['$$searchterm.term', topSearchTerms],
            },
          },
        },
      })
      .unwind('aa_searchterms')
      .project({
        term: '$aa_searchterms.term',
        url: 1,
        position: '$aa_searchterms.position',
        clicks: '$aa_searchterms.clicks',
      })
      .group({
        _id: {
          term: '$term',
          url: '$url',
          clicks: '$clicks',
        },
        position: {
          $avg: '$position',
        },
      })
      .project({
        term: '$_id.term',
        url_position: {
          url: '$_id.url',
          clicks: '$_id.clicks',
          position: '$position',
        },
      })
      .group({
        _id: '$term',
        url_positions: {
          $push: '$url_position',
        },
      })
      .project({ _id: 0, term: '$_id', url_positions: 1 })
      .exec();
  }

  async getExpectedResultsMaster(lang: 'en' | 'fr') {
    const expectedResults = await this.getExpectedResults(lang);

    return expectedResults
      .map((d) => {
        return {
          fields: {
            ...d.fields,
            Query: d.fields.Query.split(', '),
          },
        };
      })
      .map((d) => {
        return d.fields.Query.map((q, i) => {
          return {
            fields: {
              ...d.fields,
              Query: q,
            },
          };
        });
      })
      .flat() as { fields: { Id: string; Query: string; URL: string; }; }[];
  }

  async archiveSearchAssessmentData(lang: Lang = 'en') {
    const searchAssessmentData = (
      await this.airtableClient.getSearchAssessment(
        `CRA - ${lang.toUpperCase()}`
      )
    ).map((satData) => ({
      ...satData,
      _id: new Types.ObjectId(),
      lang: lang,
      date: new Date(satData.date),
      pass: !!satData.pass,
    }));

    if (searchAssessmentData.length === 0) return;

    await this.db.collections.searchAssessment.insertMany(searchAssessmentData);
  }

  async deleteSearchAssessment(lang: Lang = 'en') {
    const ids: string[] = [];

    const records = await this.getCurrentSearchAssessment(lang);

    records.forEach((d) => {
      d.id && ids.push(d.id);
    });

    return await this.airtableClient.deleteSearchAssessment(ids, lang);
  }

  async getCurrentSearchAssessment(lang: Lang) {
    return (
      await this.airtableClient.getSearchAssessment(
        `CRA - ${lang.toUpperCase()}`
      )
    )
      .map((d) => {
        return {
          id: d.airtable_id,
          fields: {
            Query: d.query,
            'Expected Result': d.expected_result,
            'Expected Position': d.expected_position,
            Date: dayjs(d.date).utc(false).format('YYYY-MM-DD'),
            taget_clicks: d.target_clicks,
            total_clicks: d.total_clicks,
            total_searches: d.total_searches,
          },
        } as CreatedFieldRecord;
      })
      .sort(
        (a, b) =>
          (b.fields['Total Searches'] || 0) - (a.fields['Total Searches'] || 0)
      );
  }

  async insertCurrentSearchAssessment(
    data: CreatedFieldRecord[],
    lang: 'en' | 'fr'
  ) {
    return await this.airtableClient.insertSearchAssessment(data, lang);
  }

  async insertExpectedDB(
    data: { fields: { Query: string; URL: string; } }[],
    lang: 'en' | 'fr'
  ) {
    return await this.airtableClient.insertExpectedDB(
      data,
      `Expected DB - ${lang.toUpperCase()}`
    );
  }

  async getExpectedResults(lang: Lang = 'en') {
    return (
      await this.airtableClient.getSearchAssessment(
        `Expected DB - ${lang.toUpperCase()}`
      )
    ).map((d) => {
      return {
        fields: {
          Id: d.airtable_id,
          Query: d.query,
          URL: d.url,
        },
      };
    });
  }
}
