import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import {
  catchError,
  merge,
  mergeMap,
  map,
  of,
  EMPTY,
  filter,
  distinctUntilChanged,
} from 'rxjs';
import { ApiService } from '@dua-upd/upd/services';
import { omit } from 'rambdax';
import {
  selectDateRanges,
  selectRouteNestedParam,
  selectDatePeriod,
  selectRoute,
  selectCurrentLang,
} from '@dua-upd/upd/state';
import {
  loadPortalPagesDetailsInit,
  loadPortalPagesDetailsSuccess,
  loadPortalPagesDetailsError,
} from './portal-pages-details.actions';
import { selectPortalPagesDetailsData } from './portal-pages-details.selectors';
import { UrlHash } from '@dua-upd/types-common';

const portalPagesRouteRegex = /\/portal-pages\//;

@Injectable()
export class PortalPagesDetailsEffects {
  private readonly actions$ = inject(Actions);
  private api = inject(ApiService);
  private store = inject(Store);

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(loadPortalPagesDetailsInit),
      concatLatestFrom(() => [
        this.store.select(selectRouteNestedParam('id')),
        this.store.select(selectDateRanges),
        this.store.select(selectPortalPagesDetailsData),
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
            return of(loadPortalPagesDetailsSuccess({ data: null }));
          }

          return this.api
            .getPortalPageDetails({
              id: pageId,
              dateRange,
              ...{ comparisonDateRange },
            })
            .pipe(
              map((data) => loadPortalPagesDetailsSuccess({ data })),
              catchError((err) => of(loadPortalPagesDetailsError({ error: err }))),
            );
        },
      ),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      concatLatestFrom(() => this.store.select(selectRoute)),
      filter(([, route]) => portalPagesRouteRegex.test(route)),
      mergeMap(() => of(loadPortalPagesDetailsInit())),
    );
  });

}
