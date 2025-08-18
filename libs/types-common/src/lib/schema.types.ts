import { Types } from 'mongoose';
import type { DateRange } from './date.types';
import type { PageStatus } from './data.types';

/*
 * AA itemId types
 */
export type AAItemIdTypes =
  | 'internalSearch'
  | 'activityMapTitle'
  | 'urlLast255'
  | 'pageUrl';

export interface ActivityMapMetrics {
  link: string;
  clicks: number;
}

export interface IAAItemId {
  _id: Types.ObjectId;
  type: AAItemIdTypes;
  page?: Types.ObjectId;
  pages?: Types.ObjectId[];
  itemId: string;
  value: string;
  title?: string;
}

/*
 * Calldriver types
 */
export interface CallsByTopic {
  _id: string;
  tasks: string;
  tpc_id: number;
  enquiry_line: string;
  topic: string;
  subtopic: string;
  sub_subtopic: string;
  calls: number;
}

export interface CallsByTasks {
  title: string;
  calls: number;
}

export interface TopCalldriverTopics extends CallsByTopic {
  Inquiry: string;
  change: number | null;
  difference: number | null;
}

export interface ICallDriver {
  _id: Types.ObjectId;
  airtable_id: string;
  date: Date;
  enquiry_line: string;
  topic?: string;
  subtopic?: string;
  sub_subtopic?: string;
  tpc_id: number; // Some records don't have a tpc_id, so they will default to this value
  impact: number;
  calls: number;
}

/*
 * Feedback types
 */
export interface FeedbackComment {
  url: string;
  date: Date;
  comment: string;
}

export interface IFeedback {
  _id: Types.ObjectId;
  airtable_id?: string;
  unique_id?: Types.ObjectId;
  url: string;
  date: Date;
  page?: Types.ObjectId;
  tasks?: Types.ObjectId[];
  projects?: Types.ObjectId[];
  lang: string;
  comment: string;
  words?: string[];
  tags?: string[];
  status?: string;
  whats_wrong?: string;
  main_section?: string;
  theme?: string;
}

/*
 * Metrics types
 */
export interface GscSearchTermMetrics {
  term: string;
  clicks: number;
  ctr: number;
  impressions: number;
  position: number;
}

export interface AASearchTermMetrics {
  term: string;
  clicks: number;
  position?: number;
  num_searches?: number;
}

export interface IMetrics {
  _id: Types.ObjectId;
  dyf_submit: number;
  dyf_yes: number;
  dyf_no: number;
  views: number;
  visits: number;
  visitors: number;
  average_time_spent: number;
  bouncerate: number;
  nav_menu_initiated: number;
  visits_geo_ab: number;
  visits_geo_bc: number;
  visits_geo_mb: number;
  visits_geo_nb: number;
  visits_geo_nl: number;
  visits_geo_ns: number;
  visits_geo_nt: number;
  visits_geo_nu: number;
  visits_geo_on: number;
  visits_geo_outside_canada: number;
  visits_geo_pe: number;
  visits_geo_qc: number;
  visits_geo_sk: number;
  visits_geo_us: number;
  visits_geo_yt: number;
  visits_referrer_other: number;
  visits_referrer_searchengine: number;
  visits_referrer_social: number;
  visits_referrer_typed_bookmarked: number;
  visits_device_other: number;
  visits_device_desktop: number;
  visits_device_mobile: number;
  visits_device_tablet: number;
  gsc_total_clicks: number;
  gsc_total_ctr: number;
  gsc_total_impressions: number;
  gsc_total_position: number;
  gsc_searchterms?: GscSearchTermMetrics[];
}

export interface IOverall extends IMetrics {
  date: Date;
  aa_searchterms_en?: AASearchTermMetrics[];
  aa_searchterms_fr?: AASearchTermMetrics[];
}

export interface IPageMetrics extends IMetrics {
  date: Date;
  url: string;
  aa_searchterms?: AASearchTermMetrics[];
  page?: Types.ObjectId | IPage;
  tasks?: Types.ObjectId[] | ITask[];
  projects?: Types.ObjectId[] | IProject[];
  ux_tests?: Types.ObjectId[] | IUxTest[];
}

export interface IPageView extends IMetrics {
  dateRange: DateRange<Date>;
  page: IPage;
  pageStatus: PageStatus;
  numComments: number;
  aa_searchterms?: AASearchTermMetrics[];
  activity_map?: ActivityMapMetrics[];
  tasks?: Types.ObjectId[];
  projects?: Types.ObjectId[];
  lastUpdated: Date;
}

/*
 * Page interface
 */
export interface IPage {
  _id: Types.ObjectId;
  url: string;
  title: string;
  airtable_id?: string;
  lang?: 'en' | 'fr';
  altLangHref?: string;
  redirect?: string;
  is_404?: boolean;
  lastChecked?: Date;
  lastModified?: Date;
  owners?: string;
  sections?: string;
  tasks?: Types.ObjectId[] | ITask[];
  projects?: Types.ObjectId[] | IProject[];
  ux_tests?: Types.ObjectId[] | IUxTest[];
}

export interface IFeedbackView {
  _id: Types.ObjectId;
  docType: 'word' | 'comment';
  refType: 'task' | 'project';
  refId: Types.ObjectId;
  dateRange: DateRange<Date>;
  lang: 'en' | 'fr';
  lastUpdated: Date;
}

export interface IFeedbackViewWord extends IFeedbackView {
  word: string;
  word_occurrences: number;
  comment_occurrences: number;
  term_frequency: number;
  comment_frequency: number;
  inverse_doc_frequency: number;
}

export interface IFeedbackViewComment extends IFeedbackView {
  url: string;
  date: Date;
  comment: string;
  owners?: string;
  sections?: string;
  rank?: number;
  commentScore?: number;
}

export type IFeedbackViewType = IFeedbackView &
  (IFeedbackViewWord | IFeedbackViewComment);

/*
 * Task interface
 */
export interface ITask {
  _id: Types.ObjectId;
  airtable_id: string;
  title: string;
  title_fr?: string;
  group: string;
  subgroup: string;
  topic: string;
  subtopic: string;
  sub_subtopic: string[];
  user_type: string[];
  ux_tests?: Types.ObjectId[] | IUxTest[];
  projects?: Types.ObjectId[] | IProject[];
  pages?: Types.ObjectId[] | IPage[];
  tpc_ids: number[];
  program?: string;
  service?: string;
  user_journey?: string[];
  status?: string;
  channel?: string[];
  core?: string[];
  portfolio?: string;
}

export interface ITaskView {
  _id: Types.ObjectId;
  dateRange: DateRange<Date>;
  task: ITask;
  totalCalls: number;
  calldriversEnquiry: { enquiry_line: string; calls: number }[];
  callsByTopic: CallsByTopic[];
  callsPerVisit: number;
  dyfNo: number;
  dyfNoPerVisit: number;
  dyfYes: number;
  visits: number;
  gsc_searchterms?: GscSearchTermMetrics[];
  gscTotalClicks: number;
  gscTotalImpressions: number;
  gscTotalCtr: number;
  gscTotalPosition: number;
  survey: number;
  survey_completed: number;
  tmf_ranking_index: number;
  cops: boolean;
  numComments: number;
  aa_searchterms?: AASearchTermMetrics[];
  metricsByDay: {
    date: string;
    calls: number;
    callsPerVisit: number;
    dyfNo: number;
    dyfNoPerVisit: number;
    dyfYes: number;
    numComments: number;
    commentsPerVisit: number;
    visits: number;
  }[];
  pages: Pick<
    IPageView,
    | '_id'
    | 'page'
    | 'pageStatus'
    | 'visits'
    | 'dyf_yes'
    | 'dyf_no'
    | 'numComments'
    | 'gsc_total_clicks'
    | 'gsc_total_impressions'
    | 'gsc_total_ctr'
    | 'gsc_total_position'
  >[];
  ux_tests?: IUxTest[];
  projects?: IProject[];
  lastUpdated: Date;
}

/*
 * Project interface
 */
export interface IProject {
  _id: Types.ObjectId;
  title: string;
  ux_tests?: Types.ObjectId[] | IUxTest[];
  pages?: Types.ObjectId[] | IPage[];
  tasks?: Types.ObjectId[] | ITask[];
  description?: string;
  attachments?: AttachmentData[];
}

/*
 * UX Test interface
 */
export interface IUxTest {
  _id: Types.ObjectId;
  title: string;
  airtable_id: string;
  project: Types.ObjectId | IProject;
  pages?: Types.ObjectId[] | IPage[];
  tasks?: Types.ObjectId[] | ITask[];
  subtask?: string;
  date?: Date;
  success_rate?: number;
  test_type?: string;
  session_type?: string;
  scenario?: string;
  vendor?: string;
  version_tested?: string;
  github_repo?: string;
  total_users?: number;
  successful_users?: number;
  program?: string;
  branch?: string;
  project_lead?: string;
  launch_date?: Date;
  status?: string;
  cops?: boolean;
  start_date?: Date;
}

export interface UrlHash {
  hash: string;
  date: Date;
  blob?: string;
}

export interface IUrl {
  _id: Types.ObjectId;
  url: string;
  title?: string;
  all_titles?: string[];
  page?: Types.ObjectId;
  metadata?: { [prop: string]: string | Date };
  langHrefs?: {
    en?: string;
    fr?: string;
    [prop: string]: string | undefined;
  };
  links?: { href: string; text: string }[];
  redirect?: string;
  last_checked?: Date;
  last_modified?: Date;
  is_404?: boolean;
  hashes?: UrlHash[];
  latest_snapshot?: string;
}

export interface AttachmentData {
  id: string;
  url: string;
  filename: string;
  size: number;
  storage_url?: string;
}

export interface IReports {
  en_title: string;
  fr_title: string;
  en_attachment: AttachmentData[];
  fr_attachment: AttachmentData[];
}
[];

export interface SearchAssessmentData {
  lang: string;
  query: string;
  expected_url: string;
  expected_position: number;
  pass: boolean;
  visits: number;
}

export interface ReadabilityScore {
  original_score: number;
  final_fk_score: number;
  fk_points: number;
  avg_words_per_paragraph: number;
  avg_words_per_header: number;
  paragraph_points: number;
  header_points: number;
  word_counts: { word: string; count: number }[];
  total_sentences: number;
  total_syllables: number;
  total_paragraph: number;
  total_headings: number;
  total_words: number;
  total_score: number;
}

export interface IReadability extends ReadabilityScore {
  _id: Types.ObjectId;
  url: string;
  lang: 'en' | 'fr';
  date: Date;
  page?: Types.ObjectId;
  hash: string;
}

/*
 * GC Tasks interface
 */

export interface IGCTasks {
  _id: Types.ObjectId;
  date: Date;
  tasks?: Types.ObjectId[] | ITask[];
  time_stamp?: string;
  url: string;
  language: string;
  device?: string;
  screener: boolean;
  department: string;
  theme: string;
  theme_other?: string;
  grouping?: string;
  gc_task: string;
  gc_task_other?: string;
  satisfaction: string;
  ease: string;
  able_to_complete: string;
  what_would_improve?: string;
  what_would_improve_comment?: string;
  reason_not_complete?: string;
  reason_not_complete_comment?: string;
  sampling?: string;
  sampling_invitation?: string;
  sampling_gc?: string;
  sampling_canada?: string;
  sampling_theme?: string;
  sampling_institution?: string;
  sampling_group?: string;
  sampling_task?: string;
}

/*
 * Annotations interface
 */
export interface IAnnotations {
  _id: Types.ObjectId;
  airtable_id: string;
  title: string;
  title_fr: string;
  event_type: AnnotationsEventType;
  description?: string;
  description_fr?: string;
  event_date: Date;
  data_affected?: AnnotationsDataAffectedType[];
  tasks_affected?: Types.ObjectId[] | ITask[];
  audience?: AnnotationsAudienceType[];
  date_entered?: Date;
  notes?: string;
  notes_fr?: string;
  predictive_insight?: string;
  predictive_insight_fr?: string;
}

export type AnnotationsEventType =
  | 'Comms'
  | 'Migration'
  | 'Data outages'
  | 'Page removal'
  | 'CRA event'
  | 'COPS Project'
  | 'Data outage'
  | 'Public holiday';

export type AnnotationsDataAffectedType =
  | 'Web traffic'
  | 'Overview'
  | 'Tasks'
  | 'Calls'
  | 'Projects'
  | 'Pages'
  | 'UX Test'
  | 'Survey'
  | 'Search'
  | 'Page feedback';

export type AnnotationsAudienceType =
  | 'Individual'
  | 'Business'
  | 'Tax professional'
  | 'Charities';

export type AccumulatorOperator =
  | '$addToSet'
  | '$avg'
  | '$count'
  | '$first'
  | '$last'
  | '$max'
  | '$mergeObjects'
  | '$min'
  | '$push'
  | '$sum';

/*
 * GCTSS to TMF Tasks mapping interface
 */
export interface IGCTasksMappings {
  _id: Types.ObjectId;
  airtable_id: string;
  title: string;
  title_fr: string;
  tasks?: Types.ObjectId[] | ITask[];
  date_mapped?: Date;
}
