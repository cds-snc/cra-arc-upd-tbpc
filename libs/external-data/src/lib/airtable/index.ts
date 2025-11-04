import { FieldSet, Query, RecordData } from 'airtable';
import { QueryParams, SortParameter } from 'airtable/lib/query_params';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Types } from 'mongoose';
import { squishTrim } from '@dua-upd/utils-common';
import type { AbstractDate, DateRange } from '@dua-upd/types-common';
import { getATClient, AirTableAPI } from './client';
import { getBases } from './base';
import { FieldRecordQuery, Lang } from './query';
import {
  CalldriverData,
  PageData,
  TaskData,
  UxTestData,
  FeedbackData,
  PageListData,
  AnnotationsData,
  ReportsData,
  GCTasksMappingsData,
} from './types';

dayjs.extend(utc);
dayjs.extend(quarterOfYear);
dayjs.extend(isSameOrBefore);

export * from './client';
export * from './types';

export const combineFormulas = (formulas: string[]) => {
  if (formulas.length === 0) {
    return '';
  }

  if (formulas.length === 1) {
    return formulas[0];
  }

  return `AND(${formulas.join(', ')})`;
};

export const createLastUpdatedFilterFormula = (date: AbstractDate) =>
  `IS_AFTER(LAST_MODIFIED_TIME(), "${dayjs.utc(date).format('YYYY-MM-DD')}")`;

export const createDateRangeFilterFormula = (
  dateRange: DateRange<AbstractDate>,
  dateField: string,
) => {
  const start = dayjs(dateRange.start)
    .utc(true)
    .subtract(1, 'day')
    .format('YYYY-MM-DD');

  const end = dayjs(dateRange.end).utc(true).add(1, 'day').format('YYYY-MM-DD');

  return `AND(\
      IS_AFTER({${dateField}}, "${start}"),\
      IS_BEFORE({${dateField}}, "${end}")\
    )`.replace(/\s+/g, ' ');
};

export class AirtableClient {
  private bases = getBases();
  client: AirTableAPI;
  feedbackClient: AirTableAPI = getATClient(process.env.AIRTABLE_TOKEN);

  constructor(apiKey?: string) {
    this.client = getATClient(apiKey);
  }

  createQuery(
    baseId: string,
    tableName: string,
    params: QueryParams<FieldSet> = {},
  ): Query<FieldSet> {
    return this.client.base(baseId)(tableName).select(params);
  }

  createFeedbackQuery(
    baseId: string,
    tableName: string,
    params: QueryParams<FieldSet> = {},
  ): Query<FieldSet> {
    return this.feedbackClient.base(baseId)(tableName).select(params);
  }

  async createInsert(
    baseId: string,
    tableName: string,
    fields: Partial<FieldSet>,
  ) {
    await this.client
      .base(baseId)(tableName)
      .create(fields, { typecast: true })
      .catch((err) => {
        console.error(err);
      });
    return Promise.resolve();
  }

  async createUpdate(
    baseId: string,
    tableName: string,
    fields: RecordData<Partial<FieldSet>>[],
  ) {
    await this.client
      .base(baseId)(tableName)
      .update(fields)
      .catch((err) => {
        console.error(err);
      });
    return Promise.resolve();
  }

  async createDestroy(baseId: string, tableName: string, id: string[]) {
    await this.client.base(baseId)(tableName).destroy(id);
    return Promise.resolve();
  }

  async deleteRecords(baseId: string, tableName: string, id: string[]) {
    const chunkSize = 10;
    const chunks = [];

    for (let i = 0; i < id.length; i += chunkSize) {
      chunks.push(id.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      await this.createDestroy(baseId, tableName, chunk);
    }
  }

  async deleteSearchAssessment(id: string[], lang: Lang = 'en') {
    return await this.deleteRecords(
      this.bases.SEARCH_ASSESSMENT,
      `CRA - ${lang.toUpperCase()}`,
      id,
    );
  }

  async insertRecords(
    baseId: string,
    tableName: string,
    records: RecordData<Partial<FieldSet>>[],
  ) {
    const chunkSize = 10;
    const chunks = [];

    for (let i = 0; i < records.length; i += chunkSize) {
      chunks.push(records.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      await this.createInsert(baseId, tableName, chunk);
    }
  }

  async updateRecords(
    baseId: string,
    tableName: string,
    records: RecordData<Partial<FieldSet>>[],
  ) {
    const chunkSize = 10;
    const chunks = [];

    for (let i = 0; i < records.length; i += chunkSize) {
      chunks.push(records.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      await this.createUpdate(baseId, tableName, chunk);
    }
  }

  async selectAll(query: Query<FieldSet>): Promise<FieldSet[]> {
    const results: FieldSet[] = [];

    await query.eachPage((records, nextPage) => {
      results.push(...records.map((r) => r._rawJson));

      nextPage();
    });

    return results;
  }

  async getSearchAssessment(
    table = 'CRA - ',
    lastUpdatedDate?: AbstractDate,
  ): Promise<FieldRecordQuery[]> {
    const params = lastUpdatedDate
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdatedDate),
        }
      : {};
    const query = this.createQuery(
      this.bases.SEARCH_ASSESSMENT,
      `${table}`,
      params,
    );

    return (await this.selectAll(query)).map(({ id, fields }) => ({
      airtable_id: id,
      query: fields['Query'],
      expected_result: fields['Expected Result'],
      expected_position: fields['Expected Position'],
      pass: fields['Pass'],
      date: fields['Date'],
      total_searches: fields['Total searches'],
      total_clicks: fields['Total clicks'],
      target_clicks: fields['Target clicks'],
      url: fields['URL'],
    })) as FieldRecordQuery[];
  }

  async insertSearchAssessment(data, lang: Lang = 'en') {
    return await this.insertRecords(
      this.bases.SEARCH_ASSESSMENT,
      `CRA - ${lang.toUpperCase()}`,
      data,
    );
  }

  async insertExpectedDB(data, table = 'Expected - EN') {
    return await this.insertRecords(
      this.bases.SEARCH_ASSESSMENT,
      `${table}`,
      data,
    );
  }

  async updateSearchAssessment(
    data: RecordData<Partial<FieldSet>>[],
    lang: Lang = 'en',
  ) {
    console.log(lang);
    return await this.updateRecords(
      this.bases.SEARCH_ASSESSMENT,
      `CRA - ${lang.toUpperCase()}`,
      data,
    );
  }

  async getTasks(lastUpdatedDate?: AbstractDate): Promise<TaskData[]> {
    const params = lastUpdatedDate
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdatedDate),
        }
      : {};
    const query = this.createQuery(this.bases.TASKS_INVENTORY, 'Tasks', params);

    return (await this.selectAll(query))
      .filter(({ fields }) => fields['Task'])
      .map(({ id, fields }) => ({
        airtable_id: id,
        title: squishTrim(fields['Task']),
        title_fr: squishTrim(fields['Task FR']),
        group: squishTrim(fields['Group']),
        subgroup: squishTrim(fields['Sub-Group']),
        topic: squishTrim(fields['Topic']),
        subtopic: squishTrim(fields['Sub Topic']),
        sub_subtopic: fields['Sub-sub-Topic']?.map(squishTrim),
        ux_tests: fields['User Testing Projects'],
        user_type: fields['User Type']?.map(squishTrim),
        pages: fields['Pages'],
        program: squishTrim(fields['Program']),
        service: squishTrim(fields['Services']),
        user_journey: fields['User Journey']?.map(squishTrim),
        status: squishTrim(fields['Status']),
        channel: fields['Channel']?.map(squishTrim),
        core: fields['Core']?.map(squishTrim),
        portfolio: squishTrim(fields['Portfolio']),
      })) as TaskData[];
  }

  async getReports(lastUpdatedDate?: AbstractDate): Promise<ReportsData[]> {
    const params = lastUpdatedDate
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdatedDate),
        }
      : {};
    const query = this.createQuery(
      this.bases.TASKS_INVENTORY,
      'TMF reports',
      params,
    );

    return (await this.selectAll(query))
      .filter(({ fields }) => Object.values(fields).some((value) => value))
      .map(({ id, fields }) => ({
        airtable_id: id,
        en_title: squishTrim(fields['TMF Report title - En']),
        fr_title: squishTrim(fields['TMF Report title - Fr']),
        type: 'tasks',
        en_attachment: fields['Report attachment - En'],
        fr_attachment: fields['Report attachment - Fr'],
        date: fields['Date added']
          ? dayjs.utc(fields['Date added']).toDate()
          : fields['Date added'],
      })) as ReportsData[];
  }

  async getUxTests(lastUpdatedDate?: AbstractDate): Promise<UxTestData[]> {
    const params = lastUpdatedDate
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdatedDate),
        }
      : {};
    const query = this.createQuery(
      this.bases.TASKS_INVENTORY,
      'User Testing',
      params,
    );

    return (await this.selectAll(query))
      .filter(({ fields }) => fields['UX Research Project Title'])
      .map(({ id, fields }) => {
        const results = {
          airtable_id: id,
          date: fields['Date']
            ? dayjs.utc(fields['Date']).toDate()
            : fields['Date'],
          title: fields['UX Research Project Title'],
          success_rate: fields['Success Rate'],
          test_type: fields['Test Type'],
          session_type: Array.isArray(fields['Session Type'])
            ? fields['Session Type'][0]
            : undefined,
          scenario: fields['Scenario/Questions'],
          tasks: fields['Task'],
          subtask: fields['Sub-Task'],
          pages: fields['Pages_RecordIds'],
          vendor: fields['Vendor'],
          version_tested: fields['Version Tested'],
          github_repo: fields['GitHub Repo'],
          total_users: fields['# of Users'],
          successful_users: fields['Succesful Users'],
          program: fields['Program/Service'],
          branch: fields['Branch'],
          audience: fields['Audience'],
          project_lead: fields['Project Lead'],
          launch_date: fields['Launch Date'],
          status: fields['Status'],
          cops: fields['COPS'],
          attachments: fields['Attachments (Ex. Scorecard)'],
          description: fields['Project Description'],
          start_date: fields['Start Date'],
        };

        return Object.fromEntries(
          Object.entries(results).map(([key, val]) => {
            if (typeof val === 'string') {
              return [key, squishTrim(val)];
            }

            if (
              Array.isArray(val) &&
              val.length &&
              typeof val[0] === 'string'
            ) {
              return [key, val.map(squishTrim)];
            }

            return [key, val];
          }),
        ) as UxTestData;
      });
  }

  async getPages(lastUpdatedDate?: AbstractDate): Promise<PageData[]> {
    const params = lastUpdatedDate
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdatedDate),
        }
      : {};
    const query = this.createQuery(this.bases.TASKS_INVENTORY, 'Pages', params);

    return (await this.selectAll(query))
      .filter(({ fields }) => !!fields['Url'])
      .map(({ id, fields }) => ({
        airtable_id: id,
        title: squishTrim(fields['Page Title'] as string)
          ?.replaceAll('Ã¢â‚¬â€œ', '–')
          .replaceAll('Ã¢â‚¬â„¢', "'"),
        url: squishTrim(fields['Url']).replace('https://', ''),
        tasks: fields['Tasks'],
      })) as PageData[];
  }

  async getAnnotations(
    lastUpdatedDate?: AbstractDate,
  ): Promise<AnnotationsData[]> {
    const params = lastUpdatedDate
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdatedDate),
        }
      : {};
    const query = this.createQuery(this.bases.ANNOTATIONS, 'Events', params);

    return (await this.selectAll(query))
      .filter(({ fields }) => Object.values(fields).some((value) => value))
      .map(({ id, fields }) => ({
        airtable_id: id,
        title: squishTrim(fields['Title']),
        title_fr: squishTrim(fields['Title FR']),
        event_type: squishTrim(fields['Event Type']),
        description: squishTrim(fields['Description']),
        description_fr: squishTrim(fields['Description FR']),
        event_date: dayjs.utc(fields['Event Date']).toDate(),
        data_affected: fields['Data affected']?.map(squishTrim),
        tasks_affected: fields['Task Ids']?.map(squishTrim),
        audience: fields['Audience']?.map(squishTrim),
        date_entered:
          fields['Date entered'] && dayjs.utc(fields['Date entered']).toDate(),
        notes: squishTrim(fields['Notes']),
        notes_fr: squishTrim(fields['Notes FR']),
        predictive_insight: squishTrim(fields['Predictive insight']),
        predictive_insight_fr: squishTrim(fields['Predictive insight FR']),
      })) as AnnotationsData[];
  }

  async getGCTasksMappings(
    lastUpdatedDate?: AbstractDate,
  ): Promise<GCTasksMappingsData[]> {
    const params = lastUpdatedDate
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdatedDate),
        }
      : {};

    const query = this.createQuery(
      this.bases.GCTASKSMAPPINGS,
      'GCTSS->TMF',
      params,
    );

    return (await this.selectAll(query))
      .filter(({ fields }) => Object.values(fields).some((value) => value))
      .map(({ id, fields }) => ({
        airtable_id: id as string,
        title: squishTrim(fields['GC TSS Task']),
        title_fr: squishTrim(fields['GC TSS Task - FR']),
        tasks: fields['TMF Task Airtable ID']?.map(squishTrim),
        date_mapped:
          fields['Date mapped'] && dayjs.utc(fields['Date mapped']).toDate(),
      }));
  }

  createCalldriverQueries(dateRange: DateRange<AbstractDate>) {
    const queries: Query<FieldSet>[] = [];

    const start = dayjs(dateRange.start).utc(true);
    const end = dayjs(dateRange.end).utc(true);

    let queryDate = dayjs(dateRange.start).utc(true);

    if (start.isBefore('2021-01-01', 'day')) {
      throw Error('Calldriver data is not available before 2021-01-01');
    }

    while (queryDate.isSameOrBefore(end)) {
      const baseId =
        this.bases[`DCD_${queryDate.year()}_Q${queryDate.quarter()}`];
      const table = `${queryDate.format('MMMM')} ${queryDate.year()}`;
      const filterByFormula = createDateRangeFilterFormula(
        dateRange,
        'CALL_DATE',
      );
      const sort = [
        { field: 'CALL_DATE', direction: 'asc' } as SortParameter<FieldSet>,
      ];

      queries.push(this.createQuery(baseId, table, { filterByFormula, sort }));

      queryDate = queryDate.add(1, 'month').startOf('month');
    }

    return queries;
  }

  async getCalldrivers(dateRange: DateRange<AbstractDate>) {
    const queries = this.createCalldriverQueries(dateRange);

    const results = [];

    for (const query of queries) {
      const records = await this.selectAll(query);

      results.push(...records);
    }

    return results.map(({ id, fields }) => ({
      airtable_id: id,
      date: dayjs(fields['CALL_DATE']).utc(true).toDate(),
      enquiry_line: fields['Enquiry_line'],
      topic: fields['Topic'],
      subtopic: fields['Sub-topic'],
      sub_subtopic: fields['Sub-sub-topic'],
      tpc_id: fields['TPC_ID'] || 999999,
      impact: fields['Impact'] || 0,
      calls: fields['Calls'] || 0,
      selfserve_yes: fields['SST_SS_Yes_Pct'],
      selfserve_no: fields['SST_SS_No_Pct'],
      selfserve_na: fields['SST_SS_NA_Pct'],
    })) as CalldriverData[];
  }

  async getFeedback(
    dateRange: DateRange<AbstractDate> = {} as typeof dateRange,
  ) {
    const filterByFormula = createDateRangeFilterFormula(dateRange, 'Date');
    const query = this.createQuery(this.bases.FEEDBACK, 'Page feedback', {
      filterByFormula,
    });

    return (await this.selectAll(query))
      .filter(({ fields }) => fields['URL'] && fields['Date'])
      .map(({ id, fields }) => {
        const unique_id =
          !fields['Unique ID'] ||
          (typeof fields['Unique ID'] === 'string' &&
            fields['Unique ID'].length !== 24)
            ? undefined
            : new Types.ObjectId(fields['Unique ID']);

        return {
          airtable_id: id,
          unique_id,
          url: squishTrim(fields['URL']).replace(/^https:\/\//i, ''),
          date: dayjs.utc(fields['Date']).toDate(),
          lang: fields['Lang'],
          comment: fields['Comment'],
          tags: fields['Lookup_tags'],
          status: fields['Status'],
          whats_wrong: fields["What's wrong"],
          main_section: fields['Main section'],
          theme: fields['Theme'],
        };
      }) as FeedbackData[];
  }

  async getLiveFeedback(
    dateRange: DateRange<AbstractDate> = {} as typeof dateRange,
  ) {
    const dateRangeFormula = createDateRangeFilterFormula(dateRange, 'Date');
    const craFilterFormula = '{Institution} = "CRA"';

    const filterByFormula = combineFormulas([
      dateRangeFormula,
      craFilterFormula,
    ]);

    const query = this.createQuery(this.bases.LIVE_FEEDBACK, 'Page feedback', {
      filterByFormula,
    });

    return (await this.selectAll(query))
      .filter(({ fields }) => fields['URL'] && fields['Date'])
      .map(({ id, fields }) => {
        const unique_id =
          !fields['Unique ID'] ||
          (typeof fields['Unique ID'] === 'string' &&
            fields['Unique ID'].length !== 24)
            ? undefined
            : new Types.ObjectId(fields['Unique ID']);

        return {
          airtable_id: id,
          unique_id,
          url: squishTrim(fields['URL']).replace(/^https:\/\//i, ''),
          date: dayjs.utc(fields['Date']).toDate(),
          lang: fields['Lang'],
          comment: fields['Comment'],
          tags: fields['Lookup_tags'],
          status: fields['Status'],
          whats_wrong: fields["What's wrong"],
          main_section: fields['Main section'],
          theme: fields['Theme'],
        };
      }) as FeedbackData[];
  }

  async getTasksTopicsMap() {
    const filterByFormula = combineFormulas([
      // 'NOT({Task} = "")',
      'NOT({Task link} = "")',
      'NOT({Task link} = BLANK())',
    ]);

    const query = this.createQuery(
      this.bases.TASKS_INVENTORY,
      'Unique Call Drivers FINAL',
      {
        filterByFormula,
      },
    );

    const results = (await this.selectAll(query)).map(
      ({ fields }) =>
        ({
          tpc_id: fields['TPC_ID'],
          tasks: fields['Task link'],
        }) as { tpc_id: number; tasks: string[] },
    );

    const tasksTopicsMap = results.reduce(
      (tasksTopicsMap, topicTasks) => {
        for (const task of topicTasks.tasks) {
          if (!tasksTopicsMap[task]) {
            tasksTopicsMap[task] = new Set();
          }
          tasksTopicsMap[task].add(topicTasks.tpc_id);
        }

        return tasksTopicsMap;
      },
      {} as Record<string, Set<number>>,
    );

    return Object.keys(tasksTopicsMap).reduce(
      (newMap, task) => {
        newMap[task] = Array.from(tasksTopicsMap[task]);
        return newMap;
      },
      {} as Record<string, number[]>,
    );
  }

  async getPagesList(lastUpdated?: Date): Promise<PageListData[]> {
    const params = lastUpdated
      ? {
          filterByFormula: createLastUpdatedFilterFormula(lastUpdated),
        }
      : {};

    const query = this.createQuery(
      this.bases.PAGES,
      'Published CRA pages',
      params,
    );

    return (await this.selectAll(query)).map<PageListData>(({ id, fields }) => {
      const url = squishTrim(fields['Page path'] as string).replace(
        'https://',
        '',
      );

      return {
        url,
        airtable_id: id,
        title: squishTrim(fields['Page title'] as string),
        lang: squishTrim(fields['Language (jcr:language)']),
        last_255: url.slice(-255),
        owners: squishTrim(fields['Group responsible']),
        sections: squishTrim(fields['Section']),
      };
    });
  }
}
