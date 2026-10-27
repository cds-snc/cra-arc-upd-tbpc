import { createPagesHomeActions } from '../../pages-home/+state/pages-home.actions';
import { createPagesHomeReducer } from '../../pages-home/+state/pages-home.reducer';
import { createPagesHomeSelectors } from '../../pages-home/+state/pages-home.selectors';
import type { PagesHomeApiConfig } from '../../pages-home/+state/pages-home.tokens';

export const PORTAL_PAGES_HOME_FEATURE_KEY = 'portalPagesHome';

export const portalPagesHomeActions = createPagesHomeActions(
  'PortalPagesHome',
);

export const portalPagesHomeSelectors = createPagesHomeSelectors(
  PORTAL_PAGES_HOME_FEATURE_KEY,
);

export const portalPagesHomeReducer = createPagesHomeReducer(
  portalPagesHomeActions,
);

export const portalPagesHomeApiConfig: PagesHomeApiConfig = {
  getHomeData: (api, params) => api.getPortalPagesHomeData(params),
  routeRegex: /\/pages\/portal(?:\/)?$/,
};
