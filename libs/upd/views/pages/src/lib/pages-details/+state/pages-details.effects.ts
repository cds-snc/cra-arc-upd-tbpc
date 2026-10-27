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
  PAGES_DETAILS_ACTIONS,
  PAGES_DETAILS_SELECTORS,
  PAGES_DETAILS_API_CONFIG,
} from './pages-details.tokens';
import { UrlHash } from '@dua-upd/types-common';
import type { LocalizedAccessibilityTestResponse } from '@dua-upd/types-common';

@Injectable()
export class PagesDetailsEffects {
  private readonly actions$ = inject(Actions);
  private api = inject(ApiService);
  private store = inject(Store);
  private readonly actions = inject(PAGES_DETAILS_ACTIONS);
  private readonly selectors = inject(PAGES_DETAILS_SELECTORS);
  private readonly apiConfig = inject(PAGES_DETAILS_API_CONFIG);

  // Distinguishes instances shared across lazy modules (pages vs portal-pages) so
  // NgRx doesn't dedupe them by class prototype and silently drop one's effects.
  ngrxOnIdentifyEffects() {
    return this.apiConfig.routeRegex.source;
  }

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(this.actions.loadPagesDetailsInit),
      concatLatestFrom(() => [
        this.store.select(selectRouteNestedParam('id')),
        this.store.select(selectDateRanges),
        this.store.select(this.selectors.selectPagesDetailsData),
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
            return of(this.actions.loadPagesDetailsSuccess({ data: null }));
          }

          return this.apiConfig
            .getDetails(this.api, {
              id: pageId,
              dateRange,
              ...{ comparisonDateRange },
            })
            .pipe(
              map((data) => this.actions.loadPagesDetailsSuccess({ data })),
              catchError((err) =>
                of(this.actions.loadPagesDetailsError({ error: err })),
              ),
            );
        },
      ),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      concatLatestFrom(() => this.store.select(selectRoute)),
      filter(([, route]) => this.apiConfig.routeRegex.test(route)),
      mergeMap(() => of(this.actions.loadPagesDetailsInit())),
    );
  });

  getHashes$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(this.actions.getHashes),
      filter(() => this.apiConfig.enableSideEffects !== false),
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
            map((data) => this.actions.getHashesSuccess({ data })),
            catchError((error) =>
              of(
                this.actions.getHashesError({
                  error: error.message || 'Failed to get hashes',
                }),
              ),
            ),
          ),
      ),
    );
  });

  loadAccessibility$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(this.actions.loadAccessibilityInit),
      filter(() => this.apiConfig.enableSideEffects !== false),
      mergeMap(({ url }) =>
        this.api
          .get<LocalizedAccessibilityTestResponse>(`/api/pages/accessibility-test?url=${encodeURIComponent(url)}`)
          .pipe(
            map((data) => this.actions.loadAccessibilitySuccess({ url, data })),
            catchError((error) => {
              // If request was cancelled (navigation away), don't dispatch error
              // This prevents the global error state from affecting other cached pages
              if (error.name === 'AbortError' || error.message?.includes('cancel')) {
                return EMPTY;
              }

              let errorKey = 'accessibility-error-generic';

              if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
                errorKey = 'accessibility-error-connection-reset';
              } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
                errorKey = 'accessibility-error-timeout';
              } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN' || error.code === 'ECONNREFUSED') {
                errorKey = 'accessibility-error-network';
              } else if (error.name === 'TimeoutError') {
                errorKey = 'accessibility-error-timeout';
              } else if (error.name === 'NetworkError') {
                errorKey = 'accessibility-error-network';
              } else if (error.status === 429) {
                errorKey = 'accessibility-error-rate-limit';
              } else if (error.status === 504 || error.status === 408) {
                errorKey = 'accessibility-error-timeout';
              } else if (error.status === 0) {
                errorKey = 'accessibility-error-network';
              } else if (error.status === 400) {
                errorKey = 'accessibility-error-invalid-url';
              } else if (error.message?.toLowerCase().includes('timeout')) {
                errorKey = 'accessibility-error-timeout';
              } else if (error.message?.toLowerCase().includes('network')) {
                errorKey = 'accessibility-error-network';
              }

              return of(this.actions.loadAccessibilityError({ error: errorKey }));
            }),
          ),
      ),
    );
  });

  triggerAccessibilityOnPageLoad$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(this.actions.loadPagesDetailsSuccess),
      filter(() => this.apiConfig.enableSideEffects !== false),
      filter(({ data }) => !!data && !!data.url),
      concatLatestFrom(() => [
        this.store.select(this.selectors.selectPagesDetailsState)
      ]),
      filter(([{ data }, state]) => {
        const url = data!.url;
        const hasCache = !!state.accessibilityByUrl[url];
        return !hasCache;
      }),
      map(([{ data }]) => this.actions.loadAccessibilityInit({ url: data!.url })),
    );
  });

  triggerPageHighlightsOnPageLoad$ = createEffect(() => {
    return merge(
      this.actions$.pipe(ofType(this.actions.loadPagesDetailsSuccess)),
      this.store.select(selectCurrentLang).pipe(distinctUntilChanged()),
    ).pipe(
      filter(() => this.apiConfig.enableSideEffects !== false),
      concatLatestFrom(() => [
        this.store.select(this.selectors.selectPagesDetailsData),
        this.store.select(this.selectors.selectPageHighlightsKey),
        this.store.select(this.selectors.selectPagesDetailsState),
        this.store.select(selectCurrentLang),
      ]),
      filter(([, data, key, state]) => !!data?.url && !!key && !state.pageHighlightsByKey[key]),
      map(([, data, key, , lang]) =>
        this.actions.loadPageHighlightsInit({
          key: key as string,
          pageData: {
            title: data.title,
            url: data.url,
            dateRange: data.dateRange,
            comparisonDateRange: data.comparisonDateRange,
            dateRangeData: data.dateRangeData &&
              omit([], data.dateRangeData),
            comparisonDateRangeData: data.comparisonDateRangeData &&
              omit([], data.comparisonDateRangeData),
            topSearchTermsIncrease: data.topSearchTermsIncrease,
            topSearchTermsDecrease: data.topSearchTermsDecrease,
            language: lang === 'fr-CA' ? 'fr' : 'en',
          },
        }),
      ),
    );
  });

  loadPageHighlights$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(this.actions.loadPageHighlightsInit),
      mergeMap(({ key, pageData }) =>
        this.api.getPageHighlights(pageData).pipe(
          map(({ highlights }) => this.actions.loadPageHighlightsSuccess({ key, highlights })),
          catchError((error) =>
            of(
              this.actions.loadPageHighlightsError({
                error: error.message || 'Failed to load page highlights',
              }),
            ),
          ),
        ),
      ),
    );
  });
}

