import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { map } from 'rxjs';
import * as DateSelectionActions from './date-selection.actions';
import * as DateSelectionSelectors from './date-selection.selectors';

@Injectable()
export class DateSelectionEffects {
  private readonly actions$ = inject(Actions);
  private store = inject(Store);
  private router = inject(Router);

  init$ = createEffect(
    () => {
      return this.actions$.pipe(
        ofType(DateSelectionActions.selectDatePeriod),
        concatLatestFrom(() =>
          this.store.select(DateSelectionSelectors.selectDateRanges),
        ),
        map(([{ selection }, { dateRange, comparisonDateRange }]) => {
          const pendingQueryParams = Object.fromEntries([
            ...new URLSearchParams(location.search).entries(),
          ]);

          if (selection === 'custom') {
            delete pendingQueryParams['dateRange'];
            delete pendingQueryParams['comparisonDateRange'];
          } else {
            delete pendingQueryParams['customDateRange'];
            delete pendingQueryParams['customComparisonDateRange'];
          }

          this.router.navigate([], {
            queryParams:
              selection === 'custom'
                ? pendingQueryParams
                : {
                    ...pendingQueryParams,
                    dateRange,
                    comparisonDateRange,
                  },
            queryParamsHandling: selection === 'custom' ? '' : '',
            replaceUrl: false,
            skipLocationChange: selection === 'custom',
          });
        }),
      );
    },
    { dispatch: false },
  );
}
