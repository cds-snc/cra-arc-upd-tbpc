import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { catchError, EMPTY, mergeMap, map, of, filter } from 'rxjs';
import { ApiService } from '@dua-upd/upd/services';
import {
  selectDatePeriod,
  selectDateRanges,
  selectRouteNestedParam,
} from '@dua-upd/upd/state';
import {
  getMostRelevantFeedback,
  getMostRelevantFeedbackSuccess,
  loadTasksDetailsError,
  loadTasksDetailsInit,
  loadTasksDetailsSuccess,
} from './tasks-details.actions';
import {
  selectTaskId,
  selectTasksDetailsData,
} from './tasks-details.selectors';
import type { MostRelevantCommentsAndWordsByLang } from '@dua-upd/types-common';

@Injectable()
export class TasksDetailsEffects {
  private readonly actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(ApiService);

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadTasksDetailsInit),
      concatLatestFrom(() => [
        this.store.select(selectRouteNestedParam('id')),
        this.store.select(selectDateRanges),
        this.store.select(selectTasksDetailsData),
      ]),
      filter(([, taskId]) => !!taskId),
      mergeMap(
        ([, taskId, { dateRange, comparisonDateRange }, taskDetailsData]) => {
          if (!taskId) {
            console.error('taskId not found when trying to load page details');
          }

          const taskIsLoaded = taskDetailsData._id === taskId; // page is already loaded (but not necessarily with the correct data)
          const dateRangeIsLoaded = taskDetailsData.dateRange === dateRange; // data for the dateRange is already loaded
          const comparisonDateRangeIsLoaded =
            taskDetailsData.comparisonDateRange === comparisonDateRange;

          if (
            taskIsLoaded &&
            dateRangeIsLoaded &&
            comparisonDateRangeIsLoaded
          ) {
            // if everything is already loaded in the state, don't update it
            return of(loadTasksDetailsSuccess({ data: null }));
          }

          return this.api
            .getTasksDetailsData({
              id: taskId,
              dateRange,
              ...{ comparisonDateRange },
            })
            .pipe(
              map((data) => loadTasksDetailsSuccess({ data })),
              catchError(() => EMPTY),
            );
        },
      ),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      mergeMap(() => of(loadTasksDetailsInit())),
    );
  });

  getMostRelevantFeedback$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(getMostRelevantFeedback),
      concatLatestFrom(() => [
        this.store.select(selectTaskId),
        this.store.select(selectDateRanges),
      ]),
      mergeMap(([, id, { dateRange }]) =>
        this.api
          .get<
            MostRelevantCommentsAndWordsByLang,
            {
              dateRange: string;
              id: string;
              type: 'task';
            }
          >('/api/feedback/most-relevant', {
            dateRange,
            id,
            type: 'task',
          })
          .pipe(
            map((data) => getMostRelevantFeedbackSuccess({ data })),
            catchError(() => EMPTY),
          ),
      ),
    );
  });
}
