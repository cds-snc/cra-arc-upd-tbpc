import { createAction, props } from '@ngrx/store';
import { PortalPagesHomeData } from '@dua-upd/types-common';

export const loadPortalPagesHomeInit = createAction('[PortalPagesHome] Init');

export const loadPortalPagesHomeSuccess = createAction(
  '[PortalPagesHome/API] Load PortalPagesHome Success',
  props<{ data: PortalPagesHomeData }>()
);

export const loadPortalPagesHomeError = createAction(
  '[PortalPagesHome/API] Load PortalPagesHome Error',
  props<{ error: string }>()
);
