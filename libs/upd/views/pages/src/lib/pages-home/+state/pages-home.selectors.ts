import { createFeatureSelector, createSelector } from '@ngrx/store';
import type { PagesHomeState } from './pages-home.reducer';
import { PAGES_HOME_FEATURE_KEY } from './pages-home.reducer';

// Factory so selectors can be bound to a different feature key (e.g. for
// `portal-pages`, which stores its data under its own feature slice).
export function createPagesHomeSelectors(featureKey: string) {
  // Lookup the 'PagesHome' feature state managed by NgRx
  const selectPagesHomeState =
    createFeatureSelector<PagesHomeState>(featureKey);

  const selectPagesHomeLoaded = createSelector(
    selectPagesHomeState,
    (state: PagesHomeState) => state.loaded
  );

  const selectPagesHomeLoading = createSelector(
    selectPagesHomeState,
    (state: PagesHomeState) => state.loading
  );

  const selectPagesHomeError = createSelector(
    selectPagesHomeState,
    (state: PagesHomeState) => state.error
  );

  const selectPagesHomeData = createSelector(
    selectPagesHomeState,
    (state: PagesHomeState) => ({
      ...(state.data || {}),
    })
  );

  return {
    selectPagesHomeState,
    selectPagesHomeLoaded,
    selectPagesHomeLoading,
    selectPagesHomeError,
    selectPagesHomeData,
  };
}

const defaultPagesHomeSelectors = createPagesHomeSelectors(
  PAGES_HOME_FEATURE_KEY,
);

export const {
  selectPagesHomeState,
  selectPagesHomeLoaded,
  selectPagesHomeLoading,
  selectPagesHomeError,
  selectPagesHomeData,
} = defaultPagesHomeSelectors;
