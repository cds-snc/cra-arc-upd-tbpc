import { createReducer, on } from '@ngrx/store';
import { OverviewFeedbackActions } from './overview-feedback.actions';
import type { OverviewFeedback } from '@dua-upd/types-common';
import { HttpErrorResponse } from '@angular/common/http';

export const OVERVIEW_FEEDBACK_FEATURE_KEY = 'overview-feedback';

export type OverviewFeedbackState = {
  loading: boolean;
  error: HttpErrorResponse | null;
  data: OverviewFeedback | null;
};

export const overviewFeedbackInitialState: OverviewFeedbackState = {
  loading: false,
  error: null,
  data: null,
};

export const overviewFeedbackReducer = createReducer(
  overviewFeedbackInitialState,
  on(
    OverviewFeedbackActions.loadFeedback,
    (state): OverviewFeedbackState => ({
      ...state,
      loading: true,
      error: null,
    }),
  ),
  on(
    OverviewFeedbackActions.loadFeedbackSuccess,
    (state, { data }): OverviewFeedbackState => ({
      ...state,
      loading: false,
      data,
    }),
  ),
  on(
    OverviewFeedbackActions.loadFeedbackError,
    (state, { error }): OverviewFeedbackState => ({
      ...state,
      loading: false,
      error,
    }),
  ),
);
