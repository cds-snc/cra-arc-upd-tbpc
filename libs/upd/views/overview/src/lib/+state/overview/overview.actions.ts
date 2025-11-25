import { createAction, props } from '@ngrx/store';
import { OverviewData } from '@dua-upd/types-common';

export const init = createAction('[Overview Page] Init');

export const loadOverviewSuccess = createAction(
  '[Overview/API] Load Overview Success',
  props<{ data: OverviewData }>(),
);

export const loadOverviewError = createAction(
  '[Overview/API] Load Overview Error',
  props<{ error: string }>(),
);

export const getCommentsAndWords = createAction(
  '[Overview Page] Get Comments And Words',
);

export const getCommentsAndWordsError = createAction(
  '[Overview/API] Get Comments And Words Error',
  props<{ error: string }>(),
);

export const getMostRelevantFeedback = createAction(
  '[Overview Page] Get Most Relevant Feedback',
);

export const getMostRelevantFeedbackError = createAction(
  '[Overview/API] Get Most Relevant Feedback Error',
  props<{ error: string }>(),
);
