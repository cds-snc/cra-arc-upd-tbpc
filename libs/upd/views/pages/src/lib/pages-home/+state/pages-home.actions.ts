import { createAction, props } from '@ngrx/store';
import { PagesHomeData } from '@dua-upd/types-common';

// Factory so the same action set can be instantiated for other app sections
// (e.g. `portal-pages`) under a distinct action-type namespace.
export function createPagesHomeActions(prefix = 'PagesHome') {
  return {
    loadPagesHomeInit: createAction(`[${prefix}] Init`),

    loadPagesHomeSuccess: createAction(
      `[${prefix}/API] Load PagesHome Success`,
      props<{ data: PagesHomeData }>(),
    ),

    loadPagesHomeError: createAction(
      `[${prefix}/API] Load PagesHome Error`,
      props<{ error: string }>(),
    ),
  };
}

export type PagesHomeActionsBundle = ReturnType<typeof createPagesHomeActions>;

const defaultPagesHomeActions = createPagesHomeActions('PagesHome');

export const {
  loadPagesHomeInit,
  loadPagesHomeSuccess,
  loadPagesHomeError,
} = defaultPagesHomeActions;
