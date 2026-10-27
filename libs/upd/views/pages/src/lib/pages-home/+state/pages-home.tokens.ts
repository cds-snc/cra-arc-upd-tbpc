import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ApiParams } from '@dua-upd/types-common';
import type { ApiService } from '@dua-upd/upd/services';
import * as DefaultPagesHomeActions from './pages-home.actions';
import * as DefaultPagesHomeSelectors from './pages-home.selectors';
import type { PagesHomeActionsBundle } from './pages-home.actions';

export type PagesHomeSelectorsBundle = typeof DefaultPagesHomeSelectors;

export interface PagesHomeApiConfig {
  /** Fetches the home-page list data from the app's API. */
  getHomeData: (api: ApiService, params: ApiParams) => Observable<unknown>;
  /** Route pattern used to know when a date-range change should trigger a refetch. */
  routeRegex: RegExp;
}

// Bundles of actions/selectors/api-config, injectable so `PagesHomeEffects` and
// `PagesHomeFacade` can be reused as-is by other app sections (e.g.
// `portal-pages`) that need their own isolated NgRx feature slice.
export const PAGES_HOME_ACTIONS = new InjectionToken<PagesHomeActionsBundle>(
  'PAGES_HOME_ACTIONS',
  { providedIn: 'root', factory: () => DefaultPagesHomeActions },
);

export const PAGES_HOME_SELECTORS = new InjectionToken<PagesHomeSelectorsBundle>(
  'PAGES_HOME_SELECTORS',
  { providedIn: 'root', factory: () => DefaultPagesHomeSelectors },
);

export const PAGES_HOME_API_CONFIG = new InjectionToken<PagesHomeApiConfig>(
  'PAGES_HOME_API_CONFIG',
  {
    providedIn: 'root',
    factory: () => ({
      getHomeData: (api, params) => api.getPagesHomeData(params),
      routeRegex: /\/pages$/,
    }),
  },
);
