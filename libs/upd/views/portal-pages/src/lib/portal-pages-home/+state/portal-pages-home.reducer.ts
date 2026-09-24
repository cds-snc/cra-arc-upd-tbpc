import { createReducer, on, Action } from '@ngrx/store';

import * as PortalPagesHomeActions from './portal-pages-home.actions';
import { PortalPagesHomeData } from '@dua-upd/types-common';

export const PORTAL_PAGES_HOME_FEATURE_KEY = 'portal-pagesHome';

export interface PortalPagesHomeState {
  data: PortalPagesHomeData | null;
  loaded: boolean; // has the PortalPagesHome list been loaded
  loading: boolean; // is the PortalPagesHome list currently being loaded
  error?: string | null; // last known error (if any)
}

export interface PortalPagesHomePartialState {
  readonly [PORTAL_PAGES_HOME_FEATURE_KEY]: PortalPagesHomeState;
}

export const portalPagesHomeInitialState: PortalPagesHomeState = {
  // set initial required properties
  data: null,
  loading: false,
  loaded: false,
  error: null,
};

const reducer = createReducer(
  portalPagesHomeInitialState,
  on(
    PortalPagesHomeActions.loadPortalPagesHomeInit,
    (state): PortalPagesHomeState => ({
      ...state,
      loading: true,
      loaded: false,
      error: null,
    }),
  ),
  on(
    PortalPagesHomeActions.loadPortalPagesHomeSuccess,
    (state, { data }): PortalPagesHomeState => ({
      data: data,
      loading: false,
      loaded: true,
      error: null,
    }),
  ),
  on(
    PortalPagesHomeActions.loadPortalPagesHomeError,
    (state, { error }): PortalPagesHomeState => ({
      ...state,
      loading: false,
      loaded: true,
      error,
    }),
  ),
);

export function PortalPagesHomeReducer(
  state: PortalPagesHomeState | undefined,
  action: Action,
) {
  return reducer(state, action);
}
