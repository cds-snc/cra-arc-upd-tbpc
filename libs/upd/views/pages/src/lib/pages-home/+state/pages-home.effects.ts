import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { catchError, EMPTY, mergeMap, map, of, filter } from 'rxjs';
import { Store } from '@ngrx/store';
import {
  selectDatePeriod,
  selectDateRanges,
  selectRoute,
} from '@dua-upd/upd/state';
import { PagesHomeData } from '@dua-upd/types-common';
import { ApiService } from '@dua-upd/upd/services';
import {
  PAGES_HOME_ACTIONS,
  PAGES_HOME_API_CONFIG,
} from './pages-home.tokens';

@Injectable()
export class PagesHomeEffects {
  private readonly actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(ApiService);
  private readonly actions = inject(PAGES_HOME_ACTIONS);
  private readonly apiConfig = inject(PAGES_HOME_API_CONFIG);

  // Distinguishes instances shared across lazy modules (pages vs portal-pages) so
  // NgRx doesn't dedupe them by class prototype and silently drop one's effects.
  ngrxOnIdentifyEffects() {
    return this.apiConfig.routeRegex.source;
  }

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(this.actions.loadPagesHomeInit),
      concatLatestFrom(() => this.store.select(selectDateRanges)),
      mergeMap(([, { dateRange }]) =>
        this.apiConfig.getHomeData(this.api, { dateRange }).pipe(
          map((data) =>
            this.actions.loadPagesHomeSuccess({ data: data as PagesHomeData }),
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
      filter(([, route]) => this.apiConfig.routeRegex.test(route)),
      mergeMap(() => of(this.actions.loadPagesHomeInit())),
    );
  });
}
