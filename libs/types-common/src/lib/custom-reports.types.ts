import type { Types } from 'mongoose';
import type { AAQueryDateEnd, AAQueryDateStart } from './date.types';
import type {
  MetricsConfig,
  AADimensionId,
  ReportSettings,
} from './adobe-analytics.types';

export type AAQueryDateRange = {
  start: AAQueryDateStart;
  end: AAQueryDateEnd;
};

export type AAQueryConfig = {
  dateRange: AAQueryDateRange;
  metricNames: AAMetricName | AAMetricName[];
  dimensionName: AADimensionName;
  urls: string | string[];
  direction?: Direction;
  limit?: number;
};

export const defaultQuerySettings: ReportSettings = {
  nonesBehavior: 'return-nones',
  countRepeatInstances: true,
  limit: 25000,
};

export const limitQuerySettings: ReportSettings = {
  nonesBehavior: 'return-nones',
  countRepeatInstances: true,
  limit: 5,
};

export type Direction = 'next' | 'previous' | 'focal';

// should calculated metrics be included? probably not?
export const metrics = {
  visits: 'metrics/visits',
  visitors: 'metrics/visitors',
  views: 'metrics/pageviews',
  average_time_spent: 'metrics/timespentvisit', // this is most likely correct, used on PAT/PP Workspace
  dyf_submit: 'metrics/event85',
  dyf_yes: 'metrics/event83',
  dyf_no: 'metrics/event84',
  bouncerate: 'metrics/bouncerate',
  nav_menu_initiated: 'metrics/event69',
  occurences: 'metrics/occurrences',
} as const satisfies MetricsConfig;

export const metricNamesMap = Object.fromEntries(
  Object.entries(metrics).map(([key, value]) => [value, key]),
);

export type AAMetricName = keyof typeof metrics;
export type AAReportMetricId = (typeof metrics)[AAMetricName];
export type AAMetricsConfig = Partial<typeof metrics>;
export type DimensionsConfig = { [prop: string]: AADimensionId };

export const dimensions = {
  day: 'variables/daterangeday',
  week: 'variables/daterangeweek', // week date = week start
  month: 'variables/daterangemonth',
  year: 'variables/daterangeyear',
  time_spent: 'variables/averagepagetime',
  city: 'variables/geocity',
  region: 'variables/georegion',
  country: 'variables/geocountry',
  referrer_type: 'variables/referrertype',
  referrer: 'variables/referrer',
  device_type: 'variables/evar4',
  prev_page: 'variables/evar19.1',
  url_last_255: 'variables/evar22',
  none: '',
  '': '',
} as const satisfies DimensionsConfig;

export const dimensionNamesMap = Object.fromEntries(
  Object.entries(dimensions).map(([key, value]) => [value, key]),
);

export type AADimensionName = keyof typeof dimensions;
export type AAReportDimensionId = (typeof dimensions)[AADimensionName];

export type ReportGranularity = 'day' | 'week' | 'month' | 'none';

export type ReportMetric = {
  id: string;
  label: string;
  description: string;
};

export type ReportDimension = {
  id: string;
  label: string;
  description: string;
};

export type ReportConfig<DateType = string> = {
  dateRange: {
    start: DateType;
    end: DateType;
  };
  granularity: ReportGranularity;
  urls: string[];
  grouped: boolean;
  metrics: AAMetricName[];
  breakdownDimension?: AADimensionName;
};

export type ReportFeedbackConfig<DateType = string> = {
  dateRange: {
    start: DateType;
    end: DateType;
  };
  pages: FeedbackSelectionData[];
  tasks: FeedbackSelectionData[];
  projects: FeedbackSelectionData[];
};

export type FeedbackSelectionData = {
  _id: string;
  title: string;
  pages?: string[];
};

export type ReportCreate = {
  _id: string;
};

export type ReportCreateError = {
  error: string;
};

export type ReportCreateResponse = ReportCreate | ReportCreateError;

export type ReportStatus = {
  status: 'pending' | 'complete' | 'error';
  message?: string;
  data?: Record<string, unknown>[];
  totalChildJobs?: number;
  completedChildJobs?: number;
};

export type DimensionMetrics = { dimensionValue: string } & {
  [metric in AAMetricName]?: number;
};

export type ICustomReportsMetrics = {
  _id: Types.ObjectId;
  url?: string;
  urls?: string[];
  startDate: Date;
  endDate: Date;
  granularity: ReportGranularity;
  grouped: boolean;
  metrics: {
    [metric in AAMetricName]?: number;
  };
  metrics_by: {
    [dimension in AADimensionName]?: DimensionMetrics[];
  };
};
