import { createReducer, on, Action } from '@ngrx/store';

import * as TasksHomeActions from './tasks-home.actions';
import { TasksHomeData } from '@dua-upd/types-common';

export const TASKS_HOME_FEATURE_KEY = 'tasksHome';

export interface TasksHomeState {
  data: TasksHomeData | null;
  loaded: boolean; // has the TasksHome list been loaded
  error?: string | null; // last known error (if any)
}

export interface TasksHomePartialState {
  readonly [TASKS_HOME_FEATURE_KEY]: TasksHomeState;
}

export const tasksHomeInitialState: TasksHomeState = {
  // set initial required properties
  data: null,
  loaded: false,
  error: null,
};

const reducer = createReducer(
  tasksHomeInitialState,
  on(
    TasksHomeActions.loadTasksHomeInit,
    (state): TasksHomeState => ({
      ...state,
      loaded: false,
      error: null,
    }),
  ),
  on(
    TasksHomeActions.loadTasksHomeSuccess,
    (state, { data }): TasksHomeState => ({
      data: data,
      loaded: true,
      error: null,
    }),
  ),
  on(
    TasksHomeActions.loadTasksHomeError,
    (state, { error }): TasksHomeState => ({
      ...state,
      loaded: true,
      error,
    }),
  ),
);

export function tasksHomeReducer(
  state: TasksHomeState | undefined,
  action: Action,
) {
  return reducer(state, action);
}
