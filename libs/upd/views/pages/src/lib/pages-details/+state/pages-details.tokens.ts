import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ApiParams, PageDetailsData } from '@dua-upd/types-common';
import type { ApiService } from '@dua-upd/upd/services';
import * as DefaultPagesDetailsActions from './pages-details.actions';
import * as DefaultPagesDetailsSelectors from './pages-details.selectors';
import type { PagesDetailsActionsBundle } from './pages-details.actions';

export type PagesDetailsSelectorsBundle = typeof DefaultPagesDetailsSelectors;

export interface PagesDetailsApiConfig {
  /** Fetches the details data for a single page/screen from the app's API. */
  getDetails: (
    api: ApiService,
    params: ApiParams,
  ) => Observable<PageDetailsData>;
  /** Route pattern used to know when a date-range change should trigger a refetch. */
  routeRegex: RegExp;
  /** Whether to fetch hashes/accessibility/highlights side-data (pages-only features). */
  enableSideEffects?: boolean;
}

// Bundles of actions/selectors/api-config, injectable so `PagesDetailsEffects`
// and `PagesDetailsFacade` can be reused as-is by other app sections (e.g.
// `portal-pages`) that need their own isolated NgRx feature slice.
export const PAGES_DETAILS_ACTIONS = new InjectionToken<PagesDetailsActionsBundle>(
  'PAGES_DETAILS_ACTIONS',
  { providedIn: 'root', factory: () => DefaultPagesDetailsActions },
);

export const PAGES_DETAILS_SELECTORS =
  new InjectionToken<PagesDetailsSelectorsBundle>('PAGES_DETAILS_SELECTORS', {
    providedIn: 'root',
    factory: () => DefaultPagesDetailsSelectors,
  });

export const PAGES_DETAILS_API_CONFIG =
  new InjectionToken<PagesDetailsApiConfig>('PAGES_DETAILS_API_CONFIG', {
    providedIn: 'root',
    factory: () => ({
      getDetails: (api, params) => api.getPageDetails(params),
      routeRegex: /\/pages\//,
      enableSideEffects: true,
    }),
  });
