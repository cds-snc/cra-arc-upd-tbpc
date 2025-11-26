import { createAction, props } from '@ngrx/store';
import { TaskDetailsData } from '@dua-upd/types-common';

export const loadTasksDetailsInit = createAction('[TasksDetails] Init');

export const loadTasksDetailsSuccess = createAction(
  '[TasksDetails/API] Load TasksDetails Success',
  props<{ data: TaskDetailsData | null }>()
);

export const loadTasksDetailsError = createAction(
  '[TasksDetails/API] Load TasksDetails Error',
  props<{ error: string }>()
);

export const getCommentsAndWords = createAction(
  '[TasksDetails/API] Get Comments And Words',
);

export const getCommentsAndWordsSuccess = createAction(
  '[TasksDetails/API] Get Comments And Words Success',
  props<{ data: TaskDetailsData['commentsAndWords'] }>(),
);

export const getCommentsAndWordsError = createAction(
  '[TasksDetails/API] Get Comments And Words Error',
  props<{ error: string }>(),
);
