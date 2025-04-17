import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, map, of, switchMap, tap } from 'rxjs';

export interface CustomReportState {
  reportData: ReportData | null;
  loading: boolean;
}

export interface ReportData {
  dateRange: string,
  taskList: any,
  projectList: any,
  dateRangeData: any,
}

// @@ set up something basic for now -- to use for all subcomponents
// https://ngrx.io/guide/component-store/usage
// https://docs.nestjs.com/techniques/server-sent-events
// https://github.com/nestjs/nest/blob/master/sample/28-sse/src/index.html (SSE example)
// https://expressjs.com/en/resources/middleware/compression.html (compression? maybe needed?)
// https://dev.to/icolomina/subscribing-to-server-sent-events-with-angular-ee8 (SSE observable example)

@Injectable()
export class CustomReportStore extends ComponentStore<CustomReportState> {
  constructor() {
    super({ reportData: null, loading: true });
  }

  private readonly http = inject(HttpClient);

  readonly reportData$ = this.select((state) => state.reportData);
  readonly loading$ = this.select((state) => state.loading);

  readonly projects$ = this.reportData$.pipe(
    map((reportData) => reportData?.projectList || [])
  );

  readonly tasks$ = this.reportData$.pipe(
    map((reportData) => reportData?.taskList || [])
  );

  readonly pages$ = this.reportData$.pipe(
    map((reportData) => [...(reportData?.dateRangeData || [])]),
  );

  readonly setReportData = this.updater((state, reportData: ReportData): CustomReportState => ({ ...state, reportData }));

  readonly loadReportData = this.effect((trigger$: Observable<void>) =>
    trigger$.pipe(
      tap(() => this.patchState({ loading: true })),
      switchMap(() => this.http.get('http://localhost:4205/api/custom-reports/report')),
      switchMap((reportData) => {
        this.setReportData(reportData as ReportData);
        return of(reportData);
      }),
      tap(() => this.patchState({ loading: false }))
    )
  );
}
