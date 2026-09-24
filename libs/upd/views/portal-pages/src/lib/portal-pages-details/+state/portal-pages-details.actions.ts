import { createAction, props } from '@ngrx/store';
import { PageDetailsData, PageHighlightsData } from '@dua-upd/types-common';
import type { LocalizedAccessibilityTestResponse } from '@dua-upd/types-common';

export const loadPortalPagesDetailsInit = createAction('[PortalPagesDetails] Load PortalPagesDetails Init');

export const loadPortalPagesDetailsSuccess = createAction(
  '[PortalPagesDetails/API] Load PortalPagesDetails Success',
  props<{ data: PageDetailsData | null }>()
);

export const loadPortalPagesDetailsError = createAction(
  '[PortalPagesDetails/API] Load PortalPagesDetails Error',
  props<{ error: string }>()
);

export const getHashes = createAction(
  '[PortalPagesDetails/API] Get Hashes',
);

export const getHashesSuccess = createAction(
  '[PortalPagesDetails/API] Get Hashes Success',
  props<{ data: PageDetailsData['hashes'] }>(),
);

export const getHashesError = createAction(
  '[PortalPagesDetails/API] Get Hashes Error',
  props<{ error: string }>(),
);

export const loadAccessibilityInit = createAction(
  '[PortalPagesDetails/API] Load Accessibility Init',
  props<{ url: string }>()
);

export const loadAccessibilitySuccess = createAction(
  '[PortalPagesDetails/API] Load Accessibility Success',
  props<{ url: string; data: LocalizedAccessibilityTestResponse }>()
);

export const loadAccessibilityError = createAction(
  '[PortalPagesDetails/API] Load Accessibility Error',
  props<{ error: string }>()
);

export const clearAccessibilityCache = createAction(
  '[PortalPagesDetails] Clear Accessibility Cache'
);

export const loadPageHighlightsInit = createAction(
  '[PortalPagesDetails/API] Load Page Highlights Init',
  props<{ key: string; pageData: PageHighlightsData }>()
);

export const loadPageHighlightsSuccess = createAction(
  '[PortalPagesDetails/API] Load Page Highlights Success',
  props<{ key: string; highlights: string[] }>()
);

export const loadPageHighlightsError = createAction(
  '[PortalPagesDetails/API] Load Page Highlights Error',
  props<{ error: string }>()
);
