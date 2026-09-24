import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { catchError, EMPTY, filter, map, mergeMap, of } from 'rxjs';
import { ApiService } from '@dua-upd/upd/services';
import { selectDatePeriod, selectDateRanges, selectRoute } from '@dua-upd/upd/state';
import { PortalPagesHomeData } from '@dua-upd/types-common';
import * as PortalPagesHomeActions from './portal-pages-home.actions';

const portalPagesRouteRegex = /\/portal-pages(?:\/)?$/;

@Injectable()
export class PortalPagesHomeEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly api = inject(ApiService);

  init$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortalPagesHomeActions.loadPortalPagesHomeInit),
      concatLatestFrom(() => this.store.select(selectDateRanges)),
      mergeMap(([, { dateRange }]) =>
        this.api.getPortalPagesHomeData({ dateRange }).pipe(
          map((data) =>
            PortalPagesHomeActions.loadPortalPagesHomeSuccess({
              data: data as PortalPagesHomeData,
            }),
          ),
          catchError((error: Error) =>
            of(
              PortalPagesHomeActions.loadPortalPagesHomeError({
                error: error.message,
              }),
            ),
          ),
        ),
      ),
    ),
  );

  dateChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(selectDatePeriod),
      concatLatestFrom(() => this.store.select(selectRoute)),
      filter(([, route]) => portalPagesRouteRegex.test(route)),
      map(() => PortalPagesHomeActions.loadPortalPagesHomeInit()),
    ),
  );
}