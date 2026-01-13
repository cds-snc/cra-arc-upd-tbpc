import {
  AdobeAnalyticsQueryBuilder,
  CALCULATED_METRICS,
  SEGMENTS,
} from '@dua-upd/node-utils';
import type {
  DateRange,
  AADimensionId,
  MetricsConfig,
  ReportFilter,
  ReportSearch,
  ReportSettings,
} from '@dua-upd/types-common';
import { chunkMap } from '@dua-upd/utils-common';

export const overallMetricsQueryConfig: MetricsConfig = {
  visits: 'metrics/visits',
  visitors: 'metrics/visitors',
  views: 'metrics/pageviews',
  average_time_spent: 'metrics/timespentvisit', // this is most likely correct, used on PAT/PP Workspace
  dyf_submit: 'metrics/event85',
  dyf_yes: 'metrics/event83',
  dyf_no: 'metrics/event84',
  bouncerate: 'metrics/bouncerate',
  rap_initiated: 'metrics/event73',
  rap_completed: 'metrics/event75',
  nav_menu_initiated: 'metrics/event69',
  // reloads: 'metrics/reloads',
  // single_page_visits: 'metrics/singlepagevisits',
  // entries: 'metrics/entries',
  // exits: 'metrics/exits',
  rap_cant_find: CALCULATED_METRICS.RAP_CANT_FIND,
  rap_login_error: CALCULATED_METRICS.RAP_LOGIN_ERROR,
  rap_other: CALCULATED_METRICS.RAP_OTHER,
  rap_sin: CALCULATED_METRICS.RAP_SIN,
  rap_info_missing: CALCULATED_METRICS.RAP_INFO_MISSING,
  rap_securekey: CALCULATED_METRICS.RAP_SECUREKEY,
  rap_other_login: CALCULATED_METRICS.RAP_OTHER_LOGIN,
  rap_gc_key: CALCULATED_METRICS.RAP_GC_KEY,
  rap_info_wrong: CALCULATED_METRICS.RAP_INFO_WRONG,
  rap_spelling: CALCULATED_METRICS.RAP_SPELLING,
  rap_access_code: CALCULATED_METRICS.RAP_ACCESS_CODE,
  rap_link_not_working: CALCULATED_METRICS.RAP_LINK_NOT_WORKING,
  rap_404: CALCULATED_METRICS.RAP_404,
  rap_blank_form: CALCULATED_METRICS.RAP_BLANK_FORM,
  fwylf_cant_find_info: CALCULATED_METRICS.FWYLF_CANT_FIND_INFO,
  fwylf_other: CALCULATED_METRICS.FWYLF_OTHER,
  fwylf_hard_to_understand: CALCULATED_METRICS.FWYLF_HARD_TO_UNDERSTAND,
  fwylf_error: CALCULATED_METRICS.FWYLF_ERROR,
  visits_geo_ab: CALCULATED_METRICS.GEO_AB,
  visits_geo_bc: CALCULATED_METRICS.GEO_BC,
  visits_geo_mb: CALCULATED_METRICS.GEO_MB,
  visits_geo_nb: CALCULATED_METRICS.GEO_NB,
  visits_geo_nl: CALCULATED_METRICS.GEO_NFL,
  visits_geo_ns: CALCULATED_METRICS.GEO_NS,
  visits_geo_nt: CALCULATED_METRICS.GEO_NWT,
  visits_geo_nu: CALCULATED_METRICS.GEO_NV,
  visits_geo_on: CALCULATED_METRICS.GEO_ON,
  visits_geo_pe: CALCULATED_METRICS.GEO_PEI,
  visits_geo_qc: CALCULATED_METRICS.GEO_QC,
  visits_geo_sk: CALCULATED_METRICS.GEO_SK,
  visits_geo_yt: CALCULATED_METRICS.GEO_YK,
  visits_geo_outside_canada: CALCULATED_METRICS.GEO_OUTSIDE_CANADA,
  visits_geo_us: CALCULATED_METRICS.GEO_US,
  visits_referrer_other: CALCULATED_METRICS.REF_OTHER_WEBSITES,
  visits_referrer_searchengine: CALCULATED_METRICS.REF_SEARCH_ENGINE,
  visits_referrer_social: CALCULATED_METRICS.REF_SOCIAL_NETWORKS,
  visits_referrer_typed_bookmarked: CALCULATED_METRICS.REF_TYPED_BOOKMARKS,
  visits_referrer_convo_ai: CALCULATED_METRICS.REF_CONVO_AI,
  visits_device_other: CALCULATED_METRICS.DEVICES_OTHER,
  visits_device_desktop: CALCULATED_METRICS.DEVICES_DESKTOP,
  visits_device_mobile: CALCULATED_METRICS.DEVICES_MOBILE,
  visits_device_tablet: CALCULATED_METRICS.DEVICES_TABLET,
  // time_less_than_15_sec: CALCULATED_METRICS.TIME_LESSTHAN15SEC,
  // time_15_to_29_sec: CALCULATED_METRICS.TIME_15TO29SEC,
  // time_30_to_59_sec: CALCULATED_METRICS.TIME_30TO59SEC,
  // time_1_to_3_min: CALCULATED_METRICS.TIME_1TO3MIN,
  // time_3_to_5_min: CALCULATED_METRICS.TIME_3TO5MIN,
  // time_5_to_10_min: CALCULATED_METRICS.TIME_5TO10MIN,
  // time_10_to_15_min: CALCULATED_METRICS.TIME_10TO15MIN,
  // time_15_to_20_min: CALCULATED_METRICS.TIME_15TO20MIN,
  // time_20_to_30_min: CALCULATED_METRICS.TIME_20TO30MIN,
  // time_more_than_30_min: CALCULATED_METRICS.TIME_MORETHAN30MIN,
};

export const createOverallMetricsQuery = (
  dateRange: DateRange<string>,
  settings: ReportSettings = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'return-nones',
    countRepeatInstances: true,
    limit: 25000,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/daterangeday')
    .setMetrics(overallMetricsQueryConfig)
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.cra },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

export interface PageMetricsQueryOptions {
  settings?: ReportSettings;
  search?: ReportSearch;
  segment?: string;
}

export const createPageMetricsQuery = (
  dateRange: DateRange<string>,
  options: PageMetricsQueryOptions = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'exclude-nones',
    countRepeatInstances: true,
    limit: 25000,
    ...options.settings,
  };

  if (options.search) {
    queryBuilder.setSearch(options.search);
  }

  return queryBuilder
    .setDimension('variables/evar22') // URL last 255 characters
    .setMetrics(overallMetricsQueryConfig)
    .setGlobalFilters([
      { type: 'segment', segmentId: options?.segment ?? SEGMENTS.cra_v2 },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

// top Tasks
export const createCXTasksQuery = (
  dateRange: DateRange<string>,
  settings: ReportSettings = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'return-nones',
    countRepeatInstances: true,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/evar90.4')
    .setMetrics({ visits: 'metrics/event110' } as MetricsConfig)
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.CX_TASKS },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

export const createBatchedInternalSearchQueries = (
  dateRange: DateRange<string>,
  itemIds?: string[],
  settings: ReportSettings = {},
) =>
  chunkMap(
    itemIds,
    (itemIdsBatch) =>
      createInternalSearchQuery(dateRange, itemIdsBatch, settings),
    200,
  );

export const createInternalSearchQuery = (
  dateRange: DateRange<string>,
  itemids?: string[],
  settings: ReportSettings & {
    lang?: 'en' | 'fr';
    includeSearchInstances?: boolean;
  } = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const lang = settings.lang;

  delete settings.lang;

  const querySettings: ReportSettings = {
    nonesBehavior: 'exclude-nones',
    countRepeatInstances: true,
    limit: 50000,
    ...settings,
  };

  const langSegment: ReportFilter[] = lang
    ? [
        {
          type: 'segment',
          segmentId: lang === 'fr' ? SEGMENTS.french : SEGMENTS.english,
        },
      ]
    : [];

  const searchInstances: MetricsConfig = settings.includeSearchInstances
    ? {
        num_searches: {
          id: 'metrics/event50',
        },
      }
    : {};

  delete settings.includeSearchInstances;

  return queryBuilder
    .setDimension('variables/evar50') // Site search
    .setMetrics({
      clicks: {
        id: 'metrics/event51',
        filters: [
          {
            itemIds: itemids,
            type: 'breakdown',
            dimension: 'variables/evar52',
          },
        ],
      },
      position: {
        id: CALCULATED_METRICS.AVG_SEARCH_RANK,
        filters: [
          {
            itemIds: itemids,
            type: 'breakdown',
            dimension: 'variables/evar52',
          },
        ],
      },
      ...searchInstances,
    })
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.cra },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
      { type: 'segment', segmentId: SEGMENTS.no_low_traffic },
      ...langSegment,
    ])
    .setSettings(querySettings)
    .build(false);
};

export const createPhrasesSearchedOnPageQuery = (
  dateRange: DateRange<string>,
  itemids: string[],
  settings: ReportSettings = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'return-nones',
    countRepeatInstances: true,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/evar50') // Site search
    .setMetrics({
      activityMap: {
        id: 'metrics/event50',
        filters: [
          {
            itemIds: itemids,
            type: 'breakdown',
            dimension: 'variables/evar19',
          },
        ],
      },
    })
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.CRA_SEARCH_PAGES },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

export const createWhereVisitorsCameFromQuery = (
  dateRange: DateRange<string>,
  itemids: string[],
  settings: ReportSettings = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'return-nones',
    countRepeatInstances: true,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/evar19') // Site search
    .setMetrics({
      activityMap: {
        id: 'metrics/visits',
        filters: [
          {
            itemIds: itemids,
            type: 'breakdown',
            dimension: 'variables/evar22',
          },
        ],
      },
    })
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.cra },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

export const createActivityMapItemIdsQuery = (
  dateRange: DateRange<string>,
  settings: ReportSettings = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'exclude-nones',
    countRepeatInstances: true,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/clickmappage') // Site search
    .setMetrics({ clicks: 'metrics/clickmaplinkinstances' } as MetricsConfig)
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.cra },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

export const createInternalSearchItemIdsQuery = (
  dateRange: DateRange<string>,
  settings: ReportSettings = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'return-nones',
    countRepeatInstances: true,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/evar52') // Site search
    .setMetrics({ visits: 'metrics/event51' } as MetricsConfig)
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.cra },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

export const itemIdQueryCreatorFactory = (
  dimension: AADimensionId,
  metric: MetricsConfig = { visits: 'metrics/visits' },
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const defaultSettings: ReportSettings = {
    nonesBehavior: 'return-nones',
    countRepeatInstances: true,
    limit: 50000,
  };

  queryBuilder
    .setDimension(dimension)
    .setMetrics(metric)
    .setSettings(defaultSettings);

  return (dateRange: DateRange<string>, settings: ReportSettings = {}) =>
    queryBuilder
      .prependGlobalFilters([
        { type: 'segment', segmentId: SEGMENTS.cra },
        { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
      ])
      .setSettings(settings)
      .build();
};

export const createActivityMapItemIdsQuerie = itemIdQueryCreatorFactory(
  'variables/clickmappage',
  { clicks: 'metrics/clickmaplinkinstances' },
);
export const createInternalSearchItemIdsQuerie = itemIdQueryCreatorFactory(
  'variables/evar52',
  { clicks: 'metrics/event51' },
);
export const createPageUrlItemIdsQuerie =
  itemIdQueryCreatorFactory('variables/evar22');

export const createPageUrlItemIdsQuery = (
  dateRange: DateRange<string>,
  settings: ReportSettings = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const querySettings: ReportSettings = {
    nonesBehavior: 'return-nones',
    countRepeatInstances: true,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/evar22') // Page URL last 255
    .setMetrics({ visits: 'metrics/visits' } as MetricsConfig)
    .setGlobalFilters([
      { type: 'segment', segmentId: SEGMENTS.cra },
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build();
};

export const createBatchedActivityMapQueries = (
  dateRange: DateRange<string>,
  itemIds?: string[],
  settings: ReportSettings = {},
) =>
  chunkMap(
    itemIds,
    (itemIdsBatch) => createActivityMapQuery(dateRange, itemIdsBatch, settings),
    200,
  );

export const createActivityMapQuery = (
  dateRange: DateRange<string>,
  itemids?: string[],
  settings: ReportSettings & {
    lang?: 'en' | 'fr';
    includeSearchInstances?: boolean;
  } = {},
) => {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  delete settings.lang;

  const querySettings: ReportSettings = {
    nonesBehavior: 'exclude-nones',
    countRepeatInstances: true,
    limit: 50000,
    ...settings,
  };

  return queryBuilder
    .setDimension('variables/clickmaplink')
    .setMetrics({
      activityMap: {
        id: 'metrics/clickmaplinkinstances',
        filters: [
          {
            itemIds: itemids,
            type: 'breakdown',
            dimension: 'variables/clickmappage',
          },
        ],
      },
    })
    .setGlobalFilters([
      { type: 'dateRange', dateRange: `${dateRange.start}/${dateRange.end}` },
    ])
    .setSettings(querySettings)
    .build(false);
};
