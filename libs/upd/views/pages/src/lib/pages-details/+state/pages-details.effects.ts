import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, mergeMap, map, of, EMPTY, filter } from 'rxjs';
import { ApiService } from '@dua-upd/upd/services';
import {
  selectDateRanges,
  selectRouteNestedParam,
  selectDatePeriod,
} from '@dua-upd/upd/state';
import {
  getHashes,
  getHashesError,
  getHashesSuccess,
  loadPagesDetailsInit,
  loadPagesDetailsSuccess,
} from './pages-details.actions';
import { selectPagesDetailsData } from './pages-details.selectors';
import { UrlHash } from '@dua-upd/types-common';

@Injectable()
export class PagesDetailsEffects {
  private readonly actions$ = inject(Actions);
  private api = inject(ApiService);
  private store = inject(Store);

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadPagesDetailsInit),
      concatLatestFrom(() => [
        this.store.select(selectRouteNestedParam('id')),
        this.store.select(selectDateRanges),
        this.store.select(selectPagesDetailsData),
      ]),
      filter(([, pageId]) => !!pageId),
      mergeMap(
        ([, pageId, { dateRange, comparisonDateRange }, pageDetailsData]) => {
          if (!pageId) {
            console.error('pageId not found when trying to load page details');
          }

          const pageIsLoaded = pageDetailsData._id === pageId; // page is already loaded (but not necessarily with the correct data)
          const dateRangeIsLoaded = pageDetailsData.dateRange === dateRange; // data for the dateRange is already loaded
          const comparisonDateRangeIsLoaded =
            pageDetailsData.comparisonDateRange === comparisonDateRange;

          if (
            pageIsLoaded &&
            dateRangeIsLoaded &&
            comparisonDateRangeIsLoaded
          ) {
            // if everything is already loaded in the state, don't update it
            return of(loadPagesDetailsSuccess({ data: null }));
          }

          return this.api
            .getPageDetails({
              id: pageId,
              dateRange,
              ...{ comparisonDateRange },
            })
            .pipe(
              map((data) => loadPagesDetailsSuccess({ data })),
              catchError(() => EMPTY),
            );
        },
      ),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      mergeMap(() => of(loadPagesDetailsInit())),
    );
  });

  getHashes$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(getHashes),
      concatLatestFrom(() => [this.store.select(selectRouteNestedParam('id'))]),
      mergeMap(([, id]) =>
        this.api
          .get<
            UrlHash[],
            {
              id: string;
            }
          >('/api/hashes/get-hashes', {
            id,
          })
          .pipe(
            map((data) => getHashesSuccess({ data })),
            catchError((error) =>
              of(getHashesError({ error: error.message || 'Failed to get hashes' })),
            ),
          ),
      ),
    );
  });
}
