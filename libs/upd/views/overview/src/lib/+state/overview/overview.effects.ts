import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, EMPTY, mergeMap, map, of, filter } from 'rxjs';
import {
  selectDateRanges,
  selectDatePeriod,
  selectRoute,
} from '@dua-upd/upd/state';
import { ApiService } from '@dua-upd/upd/services';
import * as OverviewActions from './overview.actions';

const overviewRouteRegex = /\/overview\//;

@Injectable()
export class OverviewEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly store = inject(Store);

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(OverviewActions.init),
      concatLatestFrom(() => [this.store.select(selectDateRanges)]),
      mergeMap(([, apiParams]) => {
        const ipd = new URLSearchParams(location.search).get('ipd') === 'true';

        return this.api
          .getOverviewData({
            ...apiParams,
            ipd,
          })
          .pipe(
            map((data) => OverviewActions.loadOverviewSuccess({ data })),
            catchError((err) => {
              const errorStatus = err.status;
              const errorMsg = err.statusText;

              const errorText = errorStatus
                ? `Status: ${errorStatus} - ${errorMsg}`
                : 'An unknown error occurred';

              console.error(
                `[Error] fetching overview data failed: ${errorText}`,
              );

              return of(
                OverviewActions.loadOverviewError({ error: errorText }),
              );
            }),
          );
      }),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      concatLatestFrom(() => this.store.select(selectRoute)),
      filter(([, route]) => overviewRouteRegex.test(route)),
      mergeMap(() => of(OverviewActions.init())),
    );
  });
}
