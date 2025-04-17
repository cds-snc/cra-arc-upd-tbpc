import { AdobeAnalyticsReportQuery } from '@dua-upd/node-utils';

export type DateRange = {
  start: string;
  end: string;
};

export interface AAResultsRow {
  itemId: string;
  value: string;
  data: (string | number)[];
  percentChange?: number[];
  // Below props for if anomaly detection is enabled
  dataExpected?: (string | number)[];
  dataUpperBound?: (string | number)[];
  dataLowerBound?: (string | number)[];
  dataAnomalyDetected?: boolean[];
}

export type AAResultsParser<T> = (
  columnIds: string[],
  rows: AAResultsRow[]
) => T[];

export type AAQueryCreator = (dateRange: DateRange, ...args: unknown[]) => AdobeAnalyticsReportQuery;
export type AAQueryCreatorParam = (dateRange: DateRange) => AdobeAnalyticsReportQuery;

// types/interfaces for AA API responses
export interface AABaseError {
  errorCode: string;
  errorId: string;
  errorDescription: string;
}

export interface AAColumnsMetadata {
  dimension: {
    id: string;
    type: string;
  };
  columnIds: string[];
  columnErrors?: Array<{ columnId: string } & AABaseError>;
}

export type AAResponseBody = unknown & {
  totalPages: number;
  firstPage: boolean;
  lastPage: boolean;
  numberOfElements: number;
  number: number;
  totalElements: number;
  message: string;
  request: AdobeAnalyticsReportQuery;
  reportId: string;
  columns: AAColumnsMetadata;
  rows: AAResultsRow[];
  summaryData?: AASummaryData;
};

export interface AASummaryData {
  filteredTotals: number[];
  totals: number[];
}

export interface AAErrorResponseBody extends AABaseError {
  errorDetails: unknown;
  rootCauseService: string;
}

export type AAMaybeResponse = unknown & {
  body: AAResponseBody | AAErrorResponseBody;
}

export type AAResponse = unknown & {
  body: AAResponseBody;
}

