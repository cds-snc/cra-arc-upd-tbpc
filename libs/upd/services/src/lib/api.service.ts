import { HttpClient, type HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ChunkedCommentsAndWords,
  ChunkedMostRelevantCommentsAndWords,
  DbQuery,
  PartialOverviewFeedback,
} from '@dua-upd/types-common';
import type {
  ApiParams,
  OverviewData,
  PageDetailsData,
  PagesHomeData,
  ProjectsHomeData,
  TasksHomeData,
  TaskDetailsData,
  ProjectsDetailsData,
  ReportsData,
} from '@dua-upd/types-common';

export interface ReturnedData<T> {
  dateRange: T;
  comparisonDateRange?: T;
}

export type HttpParamsType =
  | HttpParams
  | {
      [param: string]:
        | string
        | number
        | boolean
        | readonly (string | number | boolean)[];
    }
  | undefined;

@Injectable()
export class ApiService {
  private http = inject(HttpClient);

  // @StorageCache
  get<T, P extends HttpParamsType = ApiParams>(url: string, params?: P) {
    return this.http.get<T>(url, { params, responseType: 'json' });
  }

  getPagesHomeData(params: ApiParams) {
    return this.get<PagesHomeData>('/api/pages/home', params);
  }

  getPageDetails(params: ApiParams) {
    return this.get<PageDetailsData>('/api/pages/details', params);
  }

  getPageFlow(params: ApiParams) {
    return this.get('/api/pages/flow', params);
  }

  getHashes(params: ApiParams) {
    return this.get('/api/hashes', params);
  }

  getOverviewData(params: ApiParams) {
    return this.get<OverviewData>('/api/overall', params);
  }

  getOverviewFeedback(params: ApiParams) {
    return this.get<PartialOverviewFeedback>('/api/overall/feedback', params);
  }

  getOverviewCommentsAndWords(params: ApiParams) {
    return this.get<ChunkedCommentsAndWords>(
      '/api/overall/comments-and-words',
      params,
    );
  }

  getOverviewMostRelevant(params: ApiParams) {
    return this.get<ChunkedMostRelevantCommentsAndWords>(
      '/api/overall/most-relevant',
      params,
    );
  }

  getTasksHomeData(params: ApiParams) {
    return this.get<TasksHomeData>('/api/tasks/home', params);
  }

  getTasksDetailsData(params: ApiParams) {
    return this.get<TaskDetailsData>('/api/tasks/details', params);
  }

  getProjectsHomeData() {
    return this.http.get<ProjectsHomeData>('/api/projects/home');
  }

  getProjectsDetailsData(params: ApiParams) {
    return this.get<ProjectsDetailsData>('/api/projects/details', params);
  }

  getReportsData() {
    return this.http.get<ReportsData>('/api/reports');
  }

  getInternalSearchData(params: ApiParams) {
    return this.get('/api/internal-search/terms', params);
  }

  queryDb<T>(params: DbQuery) {
    const serializedQueries = Object.fromEntries(
      Object.entries(params).map(([key, value]) => [
        key,
        btoa(JSON.stringify(value)),
      ]),
    );

    return this.http.get<T>('/api/query', { params: serializedQueries });
  }
}
