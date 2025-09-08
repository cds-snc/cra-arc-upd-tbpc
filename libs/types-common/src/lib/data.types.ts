import {
  type FilterQuery,
  type ProjectionType,
  Types,
  SortOrder,
} from 'mongoose';
import type {
  AttachmentData,
  CallsByTopic,
  GscSearchTermMetrics,
  TopCalldriverTopics,
  IPage,
  IPageMetrics,
  ITask,
  IUxTest,
  IReadability,
  IAnnotations,
  IReports,
  IFeedback,
  UrlHash,
} from './schema.types';
import type { MostRelevantCommentsAndWordsByLang } from './feedback.types';

export type ApiParams =
  | ({
      dateRange: string;
      comparisonDateRange?: string;
      id?: string;
    } & {
      [param: string]:
        | string
        | number
        | boolean
        | readonly (string | number | boolean)[];
    })
  | undefined;

export interface ViewData<T> {
  dateRange: string;
  comparisonDateRange?: string;
  satDateRange?: string;
  satComparisonDateRange?: string;
  dateRangeData?: T;
  comparisonDateRangeData?: T;
}

export interface EntityList {
  _id: string;
  title: string;
  urls: (string | null)[] | null;
}

export interface EntityDetailsData<T> extends ViewData<T> {
  _id: string;
  title: string;
}

export type PagesHomeAggregatedData = Pick<IPage, '_id' | 'url' | 'title'> & {
  visits: number;
  pageStatus?: PageStatus;
};
export type PagesHomeData = ViewData<PagesHomeAggregatedData[]>;

export type PageDetailsMetrics = Pick<
  IPageMetrics,
  | 'visits'
  | 'visitors'
  | 'views'
  | 'visits_device_other'
  | 'visits_device_desktop'
  | 'visits_device_mobile'
  | 'visits_device_tablet'
  | 'average_time_spent'
  | 'gsc_total_clicks'
  | 'gsc_total_impressions'
  | 'gsc_total_ctr'
  | 'gsc_total_position'
  | 'dyf_no'
  | 'dyf_yes'
  | 'dyf_submit'
  | 'visits_geo_ab'
  | 'visits_geo_bc'
  | 'visits_geo_mb'
  | 'visits_geo_nb'
  | 'visits_geo_nl'
  | 'visits_geo_ns'
  | 'visits_geo_nt'
  | 'visits_geo_nu'
  | 'visits_geo_on'
  | 'visits_geo_pe'
  | 'visits_geo_qc'
  | 'visits_geo_sk'
  | 'visits_geo_us'
  | 'visits_geo_yt'
  | 'visits_geo_outside_canada'
  | 'visits_referrer_other'
  | 'visits_referrer_searchengine'
  | 'visits_referrer_social'
  | 'visits_referrer_typed_bookmarked'
  // | 'num_searches_internal' // todo: to be added
>;

export interface PageAggregatedData extends PageDetailsMetrics {
  visitsByDay: { date: string; visits: number }[];
  dyfByDay: {
    date: Date;
    dyf_yes: number;
    dyf_no: number;
    dyf_submit: number;
  }[];
}

export interface PageDetailsData extends EntityDetailsData<PageAggregatedData> {
  url: string;
  is404?: boolean;
  isRedirect?: boolean;
  redirect?: string;
  topSearchTermsIncrease?: GscSearchTermMetrics[];
  topSearchTermsDecrease?: GscSearchTermMetrics[];
  top25GSCSearchTerms?: GscSearchTermMetrics[];
  tasks?: ITask[];
  projects?: {
    id: string;
    title: string;
  }[];
  feedbackByDay: { date: string; sum: number }[];
  searchTerms: InternalSearchTerm[];
  readability: IReadability[];
  activityMap: ActivityMap[];
  mostRelevantCommentsAndWords: MostRelevantCommentsAndWordsByLang;
  numComments: number;
  numCommentsPercentChange: number | null;

  hashes: UrlHash[];
  alternatePageId: string;
}

export interface OverviewAggregatedData {
  visitors: number;
  visits: number;
  pageViews: number;
  impressions: number;
  ctr: number;
  position: number;
  dyf_yes: number;
  dyf_no: number;
  dyf_submit: number;
  visitsByDay: { date: string; visits: number }[];
  calldriversByDay: { date: string; calls: number }[];
  dyfByDay: {
    date: Date;
    dyf_yes: number;
    dyf_no: number;
    dyf_submit: number;
  }[];
  calldriversEnquiry: { enquiry_line: string; sum: number }[];
  topPagesVisited: { url: string; visits: number }[];
  top10GSC: GscSearchTermMetrics[];
  searchAssessmentData: {
    lang: string;
    query: string;
    expected_result: string;
    position: number;
    date: string;
    target_clicks: number;
    total_clicks: number;
    total_searches: number;
  }[];
  annotations: (Omit<IAnnotations, 'event_date'> & { event_date: string })[];
  gcTasksData: gcTasksData[];
  gcTasksComments: gcTasksComments[];
}

export interface gcTasksData {
  total_entries: number;
  gc_task: string;
  theme: string;
  satisfaction: number;
  ease: number;
  able_to_complete: number;
  margin_of_error: number;
  data_reliability:
    | 'Low margin of error/Reliable data'
    | 'Higher margin of error/Use data with caution'
    | 'Insufficient data';
}

export interface gcTasksComments {
  date: string;
  time_stamp: string;
  url: string;
  language: string;
  device: string;
  screener: boolean;
  department: string;
  theme: string;
  theme_other: string;
  grouping: string;
  gc_task: string;
  gc_task_other: string;
  satisfaction:
    | 'Very satisfied'
    | 'Satisfied'
    | 'Neutral'
    | 'Dissatisfied'
    | 'Very dissatisfied';
  ease:
    | 'Very easy'
    | 'Easy'
    | 'Neither difficult nor easy'
    | 'Difficult'
    | 'Very difficult';
  able_to_complete: 'Yes' | 'No';
  what_would_improve?: string;
  what_would_improve_comment?: string;
  reason_not_complete?: string;
  reason_not_complete_comment?: string;
}

export interface OverviewUxData {
  testsCompletedSince2018: number;
  tasksTestedSince2018: number;
  participantsTestedSince2018: number;
  testsConductedLastFiscal: number;
  testsConductedLastQuarter: number;
  copsTestsCompletedSince2018: number;
}

export interface OverviewProject extends ProjectsHomeProject {
  projectId: string;
  testType?: string[];
  totalUsers: number;
}

export interface OverviewProjectData
  extends Omit<ProjectsHomeData, 'projects'> {
  projects: OverviewProject[];
}

export type OverallSearchTerm = {
  term: string;
  total_searches: number;
  searchesChange?: number | null;
  clicks: number;
  ctr: number;
  position: number;
};

export interface OverviewData
  extends ViewData<OverviewAggregatedData>,
    OverviewUxData {
  projects?: OverviewProjectData;
  totalTasks?: number;
  uxTests: {
    title: string;
    date?: Date;
    test_type?: string;
    success_rate?: number | null;
    total_users?: number;
    scenario?: string;
  }[];
  calldriverTopics: TopCalldriverTopics[];
  top5IncreasedCalldriverTopics: TopCalldriverTopics[];
  top5DecreasedCalldriverTopics: TopCalldriverTopics[];
  searchTermsEn: OverallSearchTerm[];
  searchTermsFr: OverallSearchTerm[];
  improvedTasksKpi?: {
    uniqueTasks: number;
    successRates: SuccessRates;
  };
  improvedKpiTopSuccessRate?: {
    uniqueTopTasks: number;
    allTopTasks: number;
    topSuccessRates: SuccessRates;
  };
  topTasksTable: {
    _id: string;
    tmf_rank: number;
    title: string;
    calls_per_100_visits_percent_change: number | null;
    calls_per_100_visits_difference: number | null;
    dyf_no_per_1000_visits_percent_change: number | null;
    dyf_no_per_1000_visits_difference: number | null;
    latest_ux_success: number | null;
    latest_success_rate_difference: number | null;
    latest_success_rate_percent_change: number | null;
    survey_completed: number;
  }[];
}

export type OverviewFeedback = {
  mostRelevantCommentsAndWords: MostRelevantCommentsAndWordsByLang;
  numComments: number;
  numCommentsPercentChange: number | null;
  commentsByPage: {
    _id: string;
    title: string;
    url: string;
    sum: number;
    percentChange: number | null;
    owners?: string;
    sections?: string;
  }[];
  feedbackByDay: { date: string; sum: number }[];
};

export type PartialOverviewFeedback = OverviewFeedback & {
  mostRelevantCommentsAndWords: { parts: number };
};

export type InternalSearchTerm = {
  term: string;
  clicks: number;
  clicksChange?: number | null;
  position: number;
};

export type ActivityMap = {
  link: string;
  clicks: number;
  clicksChange?: number | null | undefined;
};

export interface TasksHomeAggregatedData {
  _id: string | Types.ObjectId;
  title: string;
  tmf_rank?: number;
  tmf_ranking_index?: number;
  top_task?: boolean;
  cops?: boolean;
  ux_testing?: boolean;
  pages_mapped?: number;
  projects_mapped?: number;
  group: string;
  subgroup: string;
  topic: string;
  subtopic: string;
  sub_subtopic?: string[];
  program?: string;
  service?: string;
  user_journey?: string[];
  status?: string;
  core?: string[];
  secure_portal?: boolean;
  channel?: string[];
  portfolio?: string;
  visits: number;
  user_type: string[];
  calls: number;
  dyf_no: number;
  latest_ux_success: number;
  survey: number;
  survey_completed: number;
  calls_per_100_visits: number;
  dyf_no_per_1000_visits: number;
  calls_per_100_visits_difference: number;
  dyf_no_per_1000_visits_difference: number;
  calls_percent_change: number | null;
  dyf_no_percent_change: number | null;
  latest_success_rate_difference: number | null;
  latest_success_rate_percent_change: number | null;
}

export type TasksHomeData = ViewData<TasksHomeAggregatedData[]> & {
  totalVisits: number;
  percentChange: number;
  totalCalls: number;
  percentChangeCalls: number;
  reports: IReports[];
};

export interface TaskDetailsMetrics {
  calldriversEnquiry: { enquiry_line: string; calls: number }[];
  callsPer100VisitsByDay: { date: string; calls: number }[];
  dyfNoPer1000VisitsByDay: { date: string; dyfNo: number }[];
  dyfYes: number;
  dyfNo: number;
}

export interface TaskDetailsData extends EntityDetailsData<TaskDetailsMetrics> {
  group: string;
  subgroup: string;
  topic: string;
  subtopic: string;
  sub_subtopic: string[];
  user_type: string[];
  tpc_ids: number[];
  program: string;
  service: string;
  user_journey: string[];
  status: string;
  channel: string[];
  core: string[];
  visits?: number;
  visitsPercentChange?: number | null;
  totalCalls?: number;
  totalCallsPercentChange?: number | null;
  callsPer100Visits?: number;
  callsPer100VisitsPercentChange?: number | null;
  callsPer100VisitsDifference?: number | null;
  dyfNoPer1000Visits?: number;
  dyfNoPer1000VisitsPercentChange?: number | null;
  dyfNoPer1000VisitsDifference?: number | null;
  gscTotalClicks?: number;
  gscTotalClicksPercentChange?: number | null;
  gscTotalImpressions?: number;
  gscTotalImpressionsPercentChange?: number | null;
  gscTotalCtr?: number;
  gscTotalCtrPercentChange?: number | null;
  gscTotalPosition?: number;
  gscTotalPositionPercentChange?: number | null;
  avgTaskSuccessFromLastTest: number;
  avgSuccessPercentChange: number;
  avgSuccessValueChange: number;
  dateFromLastTest: Date;
  taskSuccessByUxTest: {
    title: string;
    date: Date;
    test_type: string;
    success_rate: number | null;
    total_users: number;
    scenario: string;
  }[];
  projects: {
    _id: string;
    title: string;
    attachments: AttachmentData[];
  }[];
  callsByTopic: (CallsByTopic & {
    callsPercentChange?: number | null;
    callsDifference?: number | null;
  })[];
  searchTerms: InternalSearchTerm[];
  mostRelevantCommentsAndWords: MostRelevantCommentsAndWordsByLang;
  visitsByPage?: {
    _id: string;
    visits: number;
    dyfYes: number;
    dyfNo: number;
    feedbackToVisitsRatio: number | null;
    title: string;
    url: string;
    lang?: string;
    language: string;
    pageStatus: string;
    visitsPercentChange: number | null;
    dyfNoPercentChange: number | null;
    gscTotalClicks: number;
    gscTotalImpressions: number;
    gscTotalCtr: number;
    gscTotalPosition: number;
    owners: string;
    sections: string;
    numComments: number;
    numCommentsPercentChange: number | null;
  }[];
  feedbackByDay: { date: string; numComments: number }[];
  numComments?: number;
  numCommentsPercentChange?: number | null;
}

export type ProjectStatus =
  | 'Planning'
  | 'In Progress'
  | 'Exploratory'
  | 'Monitoring'
  | 'Needs review'
  | 'Complete'
  | 'Paused'
  | 'Delayed'
  | 'Unknown';

export type PageStatus = 'Live' | '404' | 'Redirected';

export type ProjectType = 'COPS';

export interface searchAssessmentColTypes {
  query: string;
  url: string;
  position: string | number;
  pass: string;
}
export interface ProjectsHomeProject {
  _id: string;
  title: string;
  cops: boolean;
  startDate?: Date;
  launchDate?: Date;
  avgSuccessRate?: number;
  lastAvgSuccessRate?: number;
  status: ProjectStatus;
  uxTests?: {
    title: string;
    date?: Date;
    success_rate?: number;
    test_type?: string;
    task?: string;
  }[];
}

export interface ProjectsHomeData {
  numInProgress: number;
  numPlanning: number;
  numCompletedLast6Months: number;
  totalCompleted: number;
  numDelayed: number;
  completedCOPS: number;
  projects: ProjectsHomeProject[];
  avgTestSuccessAvg?: number;
  testsCompleted?: number;
  uniqueTaskTestedLatestTestKpi?: number;
  avgTestSuccess?: number;
}

export type ReportsHomeProject = {
  _id: string;
  title: string;
  cops: boolean;
  startDate?: Date;
  status: ProjectStatus;
  attachments: AttachmentData[];
};

export type ReportsData = {
  projects: ReportsHomeProject[];
  tasks: IReports[];
};

export interface VisitsByPage {
  _id: string;
  url: string;
  title: string;
  visits: number;
  dyfYes?: number;
  dyfNo?: number;
  is404?: boolean;
  isRedirect?: boolean;
  redirect?: string;
  pageStatus?: PageStatus;
  owners?: string;
  sections?: string;
}

export interface ProjectDetailsAggregatedData {
  visits: number;
  dyfYes: number;
  dyfNo: number;
  gscTotalClicks: number;
  gscTotalImpressions: number;
  gscTotalCtr: number;
  gscTotalPosition: number;
  gscSearchTerms: GscSearchTermMetrics;
  visitsByPage: VisitsByPage[];
  visitsByDay: { date: string; visits: number }[];
  dyfByDay: { date: string; dyf_yes: number; dyf_no: number }[];
  calldriversByDay: { date: string; calls: number }[];
  calldriversEnquiry: { enquiry_line: string; calls: number }[];
  callsByTopic: CallsByTopic[];
  totalCalldrivers: number;
}

export interface ProjectsDetailsData
  extends EntityDetailsData<ProjectDetailsAggregatedData> {
  status: ProjectStatus;
  cops?: boolean;
  description?: string;
  startDate: string | undefined;
  launchDate: string | undefined;
  avgTaskSuccessFromLastTest: number | null;
  avgSuccessPercentChange: number | null;
  avgSuccessValueChange: number | null;
  dateFromLastTest: Date;
  taskSuccessByUxTest: (Omit<IUxTest, 'project' | 'tasks' | 'pages'> & {
    tasks: string;
  })[];
  taskMetrics: {
    _id: string;
    title: string;
    callsPer100Visits: number;
    dyfNoPer1000Visits: number;
    uxTestInLastTwoYears: boolean;
    latestSuccessRate: number;
  }[];
  searchTerms: InternalSearchTerm[];
  attachments: AttachmentData[];
  feedbackByPage: {
    _id: string;
    title: string;
    url: string;
    sum: number;
    percentChange: number | null;
  }[];
  feedbackByDay: { date: string; sum: number }[];
  mostRelevantCommentsAndWords: MostRelevantCommentsAndWordsByLang;
  numComments: number;
  numCommentsPercentChange: number | null;
}

export interface TaskKpi {
  _id: string;
  task: string;
  Baseline: number;
  Validation: number;
  Exploratory: number;
  'Spot Check': number;
  change: number;
}

export interface CalldriversTableRow {
  enquiry_line: string;
  currValue: number;
  prevValue: number;
}

// this has to be manually kept in sync with DbService['collections']
// because of circular dependency issues
export type CollectionKeys =
  | 'callDrivers'
  | 'feedback'
  | 'overall'
  | 'pageMetrics'
  | 'pageMetricsTS'
  | 'pages'
  | 'pagesList'
  | 'tasks'
  | 'uxTests'
  | 'projects'
  | 'aaItemIds'
  | 'searchAssessment'
  | 'urls'
  | 'readability'
  | 'annotations'
  | 'reports'
  | 'customReportsRegistry'
  | 'customReportsMetrics';

export type SortOption<T> = {
  [P in keyof T]?: SortOrder;
};

export type DbQuery = {
  [key: string]: {
    collection: CollectionKeys;
    filter: FilterQuery<unknown>;
    project?: ProjectionType<unknown>;
    sort?: SortOption<unknown>;
  };
};

export type SuccessRates = {
  baseline: number;
  validation: number;
  difference: number;
};

export type PageFlowData = {
  url: string;
  visits: number;
  rank?: number;
  sequence?: string | number;
  title?: string;
  total: number;
  entries?: number;
  exits?: number;
};

export type CustomReportsComment = Pick<IFeedback, 'comment' | 'date' | 'url'> & {
  taskTitles: string[];
  projectTitles: string[];
};

export type CustomReportsFeedback = {
  comments: CustomReportsComment[];
  selectedPages: { _id: string; title: string }[];
  selectedTasks: { _id: string; title: string; pages: string[] }[];
  selectedProjects: { _id: string; title: string; pages: string[] }[];
}