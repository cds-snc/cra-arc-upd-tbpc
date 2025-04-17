import { createReducer, on, Action } from '@ngrx/store';

import * as PagesHomeActions from './pages-home.actions';
import { PagesHomeData } from '@dua-upd/types-common';

export const PAGES_HOME_FEATURE_KEY = 'pagesHome';

export interface PagesHomeState {
  data: PagesHomeData | null;
  loaded: boolean; // has the PagesHome list been loaded
  loading: boolean; // is the PagesHome list currently being loaded
  error?: string | null; // last known error (if any)
}

export interface PagesHomePartialState {
  readonly [PAGES_HOME_FEATURE_KEY]: PagesHomeState;
}

export const pagesHomeInitialState: PagesHomeState = {
  // set initial required properties
  data: null,
  loading: false,
  loaded: false,
  error: null,
};

const reducer = createReducer(
  pagesHomeInitialState,
  on(
    PagesHomeActions.loadPagesHomeInit,
    (state): PagesHomeState => ({
      ...state,
      loading: true,
      loaded: false,
      error: null,
    }),
  ),
  on(
    PagesHomeActions.loadPagesHomeSuccess,
    (state, { data }): PagesHomeState => ({
      data: data,
      loading: false,
      loaded: true,
      error: null,
    }),
  ),
  on(
    PagesHomeActions.loadPagesHomeError,
    (state, { error }): PagesHomeState => ({
      ...state,
      loading: false,
      loaded: true,
      error,
    }),
  ),
);

export function pagesHomeReducer(
  state: PagesHomeState | undefined,
  action: Action,
) {
  return reducer(state, action);
}
