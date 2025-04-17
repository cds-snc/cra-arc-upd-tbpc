import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, mergeMap, map, forkJoin, of } from 'rxjs';
import { selectDateRanges } from '@dua-upd/upd/state';
import { ApiService } from '@dua-upd/upd/services';
import { OverviewFeedbackActions } from './overview-feedback.actions';
import * as OverviewActions from '../../+state/overview/overview.actions';
import { MostRelevantCommentsAndWordsByLang } from '@dua-upd/types-common';

@Injectable()
export class OverviewFeedbackEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly store = inject(Store);

  // if overview is set to loading, set feedback to loading state
  loading$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(OverviewActions.init),
      map(() => OverviewFeedbackActions.loadFeedback()),
    );
  });

  // after the rest of overview is done loading, fetch feedback from api
  load$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(OverviewActions.loadOverviewSuccess),
      concatLatestFrom(() => [this.store.select(selectDateRanges)]),
      mergeMap(([, apiParams]) => {
        const ipd = new URLSearchParams(location.search).get('ipd') === 'true';

        return this.api
          .getOverviewFeedback({
            ...apiParams,
            ipd,
          })
          .pipe(
            // initial response gives us the number of parts left to fetch for the most relevant comments and words
            // with that, we create a nested observable to fetch all parts
            mergeMap((data) => {
              const parts = Array.from(
                { length: data.mostRelevantCommentsAndWords.parts },
                (_, i) => i,
              );

              // fetch all parts in parallel
              return forkJoin(
                parts.map((part) =>
                  this.api.getOverviewMostRelevant({
                    ...apiParams,
                    ipd,
                    part,
                  }),
                ),
              ).pipe(
                // assemble all parts into the final object
                map((responses) => {
                  const enComments = responses.map((r) => r.enComments).flat();
                  const enWords = responses.map((r) => r.enWords).flat();
                  const frComments = responses.map((r) => r.frComments).flat();
                  const frWords = responses.map((r) => r.frWords).flat();

                  return {
                    ...data,
                    mostRelevantCommentsAndWords: {
                      en: {
                        comments: enComments,
                        words: enWords,
                      },
                      fr: {
                        comments: frComments,
                        words: frWords,
                      },
                    } as MostRelevantCommentsAndWordsByLang,
                  };
                }),
              );
            }),
            map((data) =>
              OverviewFeedbackActions.loadFeedbackSuccess({ data }),
            ),
            catchError((err: HttpErrorResponse) =>
              of(OverviewFeedbackActions.loadFeedbackError({ error: err })),
            ),
          );
      }),
    );
  });
}
