import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { catchError, EMPTY, mergeMap, map, of, filter } from 'rxjs';
import * as PagesHomeActions from './pages-home.actions';
import { Store } from '@ngrx/store';
import {
  selectDatePeriod,
  selectDateRanges,
  selectRoute,
} from '@dua-upd/upd/state';
import { PagesHomeData } from '@dua-upd/types-common';
import { ApiService } from '@dua-upd/upd/services';

const pagesRouteRegex = /\/pages$/;

@Injectable()
export class PagesHomeEffects {
  private readonly actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(ApiService);

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(PagesHomeActions.loadPagesHomeInit),
      concatLatestFrom(() => this.store.select(selectDateRanges)),
      mergeMap(([, { dateRange }]) =>
        this.api.getPagesHomeData({ dateRange }).pipe(
          map((data: PagesHomeData) =>
            PagesHomeActions.loadPagesHomeSuccess({ data }),
          ),
          catchError(() => EMPTY),
        ),
      ),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      concatLatestFrom(() => this.store.select(selectRoute)),
      filter(([, route]) => pagesRouteRegex.test(route)),
      mergeMap(() => of(PagesHomeActions.loadPagesHomeInit())),
    );
  });
}
