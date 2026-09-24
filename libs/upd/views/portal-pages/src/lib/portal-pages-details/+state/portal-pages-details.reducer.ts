import { createReducer, on, Action } from '@ngrx/store';

import * as PortalPagesDetailsActions from './portal-pages-details.actions';
import { PortalPageDetailsData } from '@dua-upd/types-common';
import type { LocalizedAccessibilityTestResponse } from '@dua-upd/types-common';

export const PORTAL_PAGES_DETAILS_FEATURE_KEY = 'portalPagesDetails';

const MAX_ACCESSIBILITY_CACHE_SIZE = 50;

export interface PortalPagesDetailsState {
  data: PortalPageDetailsData;
  loaded: boolean; // has the PortalPagesDetails list been loaded
  loading: boolean; // is the PortalPagesDetails list currently being loaded
  error?: string | null; // last known error (if any)
  loadedHashes: boolean;
  loadingHashes: boolean;
  errorHashes?: string | null;
  accessibilityByUrl: Record<string, LocalizedAccessibilityTestResponse>;
  loadedAccessibility: boolean;
  loadingAccessibility: boolean;
  errorAccessibility?: string | null;
  pageHighlightsByKey: Record<string, string[]>;
  loadedPageHighlights: boolean;
  loadingPageHighlights: boolean;
  errorPageHighlights?: string | null;
}

export interface PortalPagesDetailsPartialState {
  readonly [PORTAL_PAGES_DETAILS_FEATURE_KEY]: PortalPagesDetailsState;
}

export const portalPagesDetailsInitialState: PortalPagesDetailsState = {
  // set initial required properties
  data: {
    _id: '',
    url: '',
    title: '',
    screen_id: '',
    dateRange: '',
    comparisonDateRange: '',
  },
  loading: false,
  loaded: false,
  error: null,
  loadingHashes: false,
  loadedHashes: false,
  errorHashes: null,
  accessibilityByUrl: {},
  loadedAccessibility: false,
  loadingAccessibility: false,
  errorAccessibility: null,
  pageHighlightsByKey: {},
  loadedPageHighlights: false,
  loadingPageHighlights: false,
  errorPageHighlights: null,
};

const reducer = createReducer(
  portalPagesDetailsInitialState,
  on(
    PortalPagesDetailsActions.loadPortalPagesDetailsInit,
    (state): PortalPagesDetailsState => ({
      ...state,
      loading: true,
      loadingHashes: true,
      loaded: false,
      error: null,
    }),
  ),
  on(
    PortalPagesDetailsActions.loadPortalPagesDetailsSuccess,
    (state, { data }): PortalPagesDetailsState => {
      if (data === null) {
        return {
          ...state,
          loading: false,
          loaded: true,
          error: null,
        };
      }

      return {
        ...state,
        data: { ...state.data, ...data },
        loading: false,
        loaded: true,
        error: null,
      };
    }
  ),
  on(
    PortalPagesDetailsActions.loadPortalPagesDetailsError,
    (state, { error }): PortalPagesDetailsState => ({
      ...state,
      loading: false,
      loaded: true,
      error,
    }),
  ),
  on(
    PortalPagesDetailsActions.getHashes,
    (state): PortalPagesDetailsState => ({
      ...state,
      loadingHashes: true,
      loadedHashes: false,
      errorHashes: null,
    }),
  ),
  on(
    PortalPagesDetailsActions.getHashesSuccess,
    (state, { data }): PortalPagesDetailsState =>
      data === null
        ? {
            ...state,
            loadingHashes: false,
            loadedHashes: true,
            errorHashes: null,
          }
        : {
            ...state,
            data: {
              ...state.data,
            },
            loadingHashes: false,
            loadedHashes: true,
            errorHashes: null,
          },
  ),
  on(
    PortalPagesDetailsActions.getHashesError,
    (state, { error }): PortalPagesDetailsState => ({
      ...state,
      loadingHashes: false,
      loadedHashes: true,
      errorHashes: error,
    }),
  ),
  on(
    PortalPagesDetailsActions.loadAccessibilityInit,
    (state): PortalPagesDetailsState => {
      return {
        ...state,
        loadingAccessibility: true,
        loadedAccessibility: false,
        errorAccessibility: null,
      };
    }
  ),
  on(
    PortalPagesDetailsActions.loadAccessibilitySuccess,
    (state, { url, data }): PortalPagesDetailsState => {
      const currentCache = state.accessibilityByUrl;
      const cacheKeys = Object.keys(currentCache);

      // Implement LRU cache: if cache is at limit, remove oldest entry (first key)
      let updatedCache = { ...currentCache };
      if (cacheKeys.length >= MAX_ACCESSIBILITY_CACHE_SIZE && !currentCache[url]) {
        // Only evict if adding NEW url (not updating existing)
        const [, ...remainingUrls] = cacheKeys;
        updatedCache = remainingUrls.reduce((acc, key) => {
          acc[key] = currentCache[key];
          return acc;
        }, {} as Record<string, LocalizedAccessibilityTestResponse>);
      }

      const newCache = {
        ...updatedCache,
        [url]: data, // Store/update data by URL
      };

      return {
        ...state,
        accessibilityByUrl: newCache,
        loadingAccessibility: false,
        loadedAccessibility: true,
        errorAccessibility: null,
      };
    },
  ),
  on(
    PortalPagesDetailsActions.loadAccessibilityError,
    (state, { error }): PortalPagesDetailsState => ({
      ...state,
      loadingAccessibility: false,
      loadedAccessibility: true,
      errorAccessibility: error,
    }),
  ),
  on(
    PortalPagesDetailsActions.clearAccessibilityCache,
    (state): PortalPagesDetailsState => ({
      ...state,
      accessibilityByUrl: {},
      loadedAccessibility: false,
      loadingAccessibility: false,
      errorAccessibility: null,
    }),
  ),
  on(
    PortalPagesDetailsActions.loadPageHighlightsInit,
    (state): PortalPagesDetailsState => ({
      ...state,
      loadingPageHighlights: true,
      loadedPageHighlights: false,
      errorPageHighlights: null,
    }),
  ),
  on(
    PortalPagesDetailsActions.loadPageHighlightsSuccess,
    (state, { key, highlights }): PortalPagesDetailsState => ({
      ...state,
      pageHighlightsByKey: {
        ...state.pageHighlightsByKey,
        [key]: highlights,
      },
      loadingPageHighlights: false,
      loadedPageHighlights: true,
      errorPageHighlights: null,
    }),
  ),
  on(
    PortalPagesDetailsActions.loadPageHighlightsError,
    (state, { error }): PortalPagesDetailsState => ({
      ...state,
      loadingPageHighlights: false,
      loadedPageHighlights: true,
      errorPageHighlights: error,
    }),
  ),
);

export function PortalPagesDetailsReducer(
  state: PortalPagesDetailsState | undefined,
  action: Action,
) {
  return reducer(state, action);
}
