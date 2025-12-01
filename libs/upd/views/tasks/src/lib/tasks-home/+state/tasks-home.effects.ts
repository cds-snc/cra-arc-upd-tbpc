import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, EMPTY, mergeMap, map, of, filter } from 'rxjs';
import {
  selectDatePeriod,
  selectDateRanges,
  selectRoute,
} from '@dua-upd/upd/state';
import { ApiService } from '@dua-upd/upd/services';
import * as TasksHomeActions from './tasks-home.actions';

const tasksRouteRegex = /\/tasks$/;

@Injectable()
export class TasksHomeEffects {
  private readonly actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(ApiService);

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(TasksHomeActions.loadTasksHomeInit),
      concatLatestFrom(() => this.store.select(selectDateRanges)),
      mergeMap(([, { dateRange, comparisonDateRange }]) =>
        this.api.getTasksHomeData({ dateRange, comparisonDateRange }).pipe(
          map((data) => TasksHomeActions.loadTasksHomeSuccess({ data })),
          catchError(() => EMPTY),
        ),
      ),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      concatLatestFrom(() => this.store.select(selectRoute)),
      filter(([, route]) => tasksRouteRegex.test(route)),
      mergeMap(() => of(TasksHomeActions.loadTasksHomeInit())),
    );
  });
}
