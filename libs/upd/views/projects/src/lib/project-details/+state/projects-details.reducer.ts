import { createReducer, on, Action } from '@ngrx/store';

import type { ProjectsDetailsData } from '@dua-upd/types-common';
import * as ProjectsDetailsActions from './projects-details.actions';

export const PROJECTS_DETAILS_FEATURE_KEY = 'projectsDetails';

export interface ProjectsDetailsState {
  data: ProjectsDetailsData;
  loaded: boolean; // has the ProjectsDetails list been loaded
  loading: boolean; // is the ProjectsDetails list currently being loaded
  error?: string | null; // last known error (if any)
}

export interface ProjectsDetailsPartialState {
  readonly [PROJECTS_DETAILS_FEATURE_KEY]: ProjectsDetailsState;
}

export const projectDetailsInitialState: ProjectsDetailsState = {
  // set initial required properties
  data: {
    _id: '',
    title: '',
    status: 'Unknown',
    startDate: undefined,
    launchDate: undefined,
    dateRange: '',
    comparisonDateRange: '',
    avgTaskSuccessFromLastTest: null,
    avgSuccessPercentChange: null,
    avgSuccessValueChange: null,
    dateFromLastTest: new Date(0),
    taskSuccessByUxTest: [],
    taskMetrics: [],
    searchTerms: [],
    attachments: [],
    feedbackByPage: [],
    feedbackByDay: [],
    mostRelevantCommentsAndWords: {
      en: { comments: [], words: [] },
      fr: { comments: [], words: [] },
    },
    numComments: 0,
    numCommentsPercentChange: null,
  },
  loaded: false,
  loading: false,
  error: null,
};

const reducer = createReducer(
  projectDetailsInitialState,
  on(
    ProjectsDetailsActions.loadProjectsDetailsInit,
    (state): ProjectsDetailsState => ({
      ...state,
      loaded: false,
      loading: true,
      error: null,
    }),
  ),
  on(
    ProjectsDetailsActions.loadProjectsDetailsSuccess,
    (state, { data }): ProjectsDetailsState =>
      data === null
        ? {
            ...state,
            loaded: true,
            loading: false,
            error: null,
          }
        : {
            ...state,
            data: { ...data },
            loaded: true,
            loading: false,
            error: null,
          },
  ),
  on(
    ProjectsDetailsActions.loadProjectsDetailsError,
    (state, { error }): ProjectsDetailsState => ({
      ...state,
      loaded: true,
      loading: false,
      error,
    }),
  ),
);

export function projectsDetailsReducer(
  state: ProjectsDetailsState | undefined,
  action: Action,
) {
  return reducer(state, action);
}
