import { createAction, props } from '@ngrx/store';
import { PageDetailsData, PageHighlightsData } from '@dua-upd/types-common';
import type { LocalizedAccessibilityTestResponse } from '@dua-upd/types-common';

// Factory so the same action set can be instantiated multiple times (e.g. for
// `pages` and `portal-pages`) under distinct action-type namespaces, avoiding
// cross-talk between separate NgRx feature slices that share this state shape.
export function createPagesDetailsActions(prefix = 'PagesDetails') {
  return {
    loadPagesDetailsInit: createAction(`[${prefix}] Load PagesDetails Init`),

    loadPagesDetailsSuccess: createAction(
      `[${prefix}/API] Load PagesDetails Success`,
      props<{ data: PageDetailsData | null }>(),
    ),

    loadPagesDetailsError: createAction(
      `[${prefix}/API] Load PagesDetails Error`,
      props<{ error: string }>(),
    ),

    getHashes: createAction(`[${prefix}/API] Get Hashes`),

    getHashesSuccess: createAction(
      `[${prefix}/API] Get Hashes Success`,
      props<{ data: PageDetailsData['hashes'] }>(),
    ),

    getHashesError: createAction(
      `[${prefix}/API] Get Hashes Error`,
      props<{ error: string }>(),
    ),

    loadAccessibilityInit: createAction(
      `[${prefix}/API] Load Accessibility Init`,
      props<{ url: string }>(),
    ),

    loadAccessibilitySuccess: createAction(
      `[${prefix}/API] Load Accessibility Success`,
      props<{ url: string; data: LocalizedAccessibilityTestResponse }>(),
    ),

    loadAccessibilityError: createAction(
      `[${prefix}/API] Load Accessibility Error`,
      props<{ error: string }>(),
    ),

    clearAccessibilityCache: createAction(
      `[${prefix}] Clear Accessibility Cache`,
    ),

    loadPageHighlightsInit: createAction(
      `[${prefix}/API] Load Page Highlights Init`,
      props<{ key: string; pageData: PageHighlightsData }>(),
    ),

    loadPageHighlightsSuccess: createAction(
      `[${prefix}/API] Load Page Highlights Success`,
      props<{ key: string; highlights: string[] }>(),
    ),

    loadPageHighlightsError: createAction(
      `[${prefix}/API] Load Page Highlights Error`,
      props<{ error: string }>(),
    ),
  };
}

export type PagesDetailsActionsBundle = ReturnType<
  typeof createPagesDetailsActions
>;

const defaultPagesDetailsActions = createPagesDetailsActions('PagesDetails');

export const {
  loadPagesDetailsInit,
  loadPagesDetailsSuccess,
  loadPagesDetailsError,
  getHashes,
  getHashesSuccess,
  getHashesError,
  loadAccessibilityInit,
  loadAccessibilitySuccess,
  loadAccessibilityError,
  clearAccessibilityCache,
  loadPageHighlightsInit,
  loadPageHighlightsSuccess,
  loadPageHighlightsError,
} = defaultPagesDetailsActions;
