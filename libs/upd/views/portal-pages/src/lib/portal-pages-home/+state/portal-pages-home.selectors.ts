import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PORTAL_PAGES_HOME_FEATURE_KEY, PortalPagesHomeState } from './portal-pages-home.reducer';

// Lookup the 'PortalPagesHome' feature state managed by NgRx
export const selectPortalPagesHomeState = createFeatureSelector<PortalPagesHomeState>(
  PORTAL_PAGES_HOME_FEATURE_KEY
);

export const selectPortalPagesHomeLoaded = createSelector(
  selectPortalPagesHomeState,
  (state: PortalPagesHomeState) => state.loaded
);

export const selectPortalPagesHomeLoading = createSelector(
  selectPortalPagesHomeState,
  (state: PortalPagesHomeState) => state.loading
);

export const selectPortalPagesHomeError = createSelector(
  selectPortalPagesHomeState,
  (state: PortalPagesHomeState) => state.error
);

export const selectPortalPagesHomeData = createSelector(
  selectPortalPagesHomeState,
  (state: PortalPagesHomeState) => ({
    ...(state.data || {}),
  })
);
