import { createAction, props } from '@ngrx/store';
import { PageDetailsData, PageHighlightsData } from '@dua-upd/types-common';
import type { LocalizedAccessibilityTestResponse } from '@dua-upd/types-common';

export const loadPagesDetailsInit = createAction('[PagesDetails] Load PagesDetails Init');

export const loadPagesDetailsSuccess = createAction(
  '[PagesDetails/API] Load PagesDetails Success',
  props<{ data: PageDetailsData | null }>()
);

export const loadPagesDetailsError = createAction(
  '[PagesDetails/API] Load PagesDetails Error',
  props<{ error: string }>()
);

export const getHashes = createAction(
  '[PagesDetails/API] Get Hashes',
);

export const getHashesSuccess = createAction(
  '[PagesDetails/API] Get Hashes Success',
  props<{ data: PageDetailsData['hashes'] }>(),
);

export const getHashesError = createAction(
  '[PagesDetails/API] Get Hashes Error',
  props<{ error: string }>(),
);

export const loadAccessibilityInit = createAction(
  '[PagesDetails/API] Load Accessibility Init',
  props<{ url: string }>()
);

export const loadAccessibilitySuccess = createAction(
  '[PagesDetails/API] Load Accessibility Success',
  props<{ url: string; data: LocalizedAccessibilityTestResponse }>()
);

export const loadAccessibilityError = createAction(
  '[PagesDetails/API] Load Accessibility Error',
  props<{ error: string }>()
);

export const clearAccessibilityCache = createAction(
  '[PagesDetails] Clear Accessibility Cache'
);

export const loadPageHighlightsInit = createAction(
  '[PagesDetails/API] Load Page Highlights Init',
  props<{ key: string; pageData: PageHighlightsData }>()
);

export const loadPageHighlightsSuccess = createAction(
  '[PagesDetails/API] Load Page Highlights Success',
  props<{ key: string; highlights: string[] }>()
);

export const loadPageHighlightsError = createAction(
  '[PagesDetails/API] Load Page Highlights Error',
  props<{ error: string }>()
);
