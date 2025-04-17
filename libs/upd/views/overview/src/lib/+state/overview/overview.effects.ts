import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, EMPTY, mergeMap, map, of } from 'rxjs';
import { selectDateRanges, selectDatePeriod } from '@dua-upd/upd/state';
import { ApiService } from '@dua-upd/upd/services';
import * as OverviewActions from './overview.actions';

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
            catchError(() => EMPTY),
          );
      }),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      mergeMap(() => of(OverviewActions.init())),
    );
  });
}
