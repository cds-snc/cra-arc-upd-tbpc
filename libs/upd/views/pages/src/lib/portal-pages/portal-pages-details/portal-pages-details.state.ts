import { createPagesDetailsActions } from '../../pages-details/+state/pages-details.actions';
import { createPagesDetailsReducer } from '../../pages-details/+state/pages-details.reducer';
import { createPagesDetailsSelectors } from '../../pages-details/+state/pages-details.selectors';
import type { PagesDetailsApiConfig } from '../../pages-details/+state/pages-details.tokens';

export const PORTAL_PAGES_DETAILS_FEATURE_KEY = 'portalPagesDetails';

export const portalPagesDetailsActions = createPagesDetailsActions(
  'PortalPagesDetails',
);

export const portalPagesDetailsSelectors = createPagesDetailsSelectors(
  PORTAL_PAGES_DETAILS_FEATURE_KEY,
);

export const portalPagesDetailsReducer = createPagesDetailsReducer(
  portalPagesDetailsActions,
);

export const portalPagesDetailsApiConfig: PagesDetailsApiConfig = {
  getDetails: (api, params) => api.getPortalPageDetails(params),
  routeRegex: /\/pages\/portal\//,
  enableSideEffects: false,
};
