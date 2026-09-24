import {
  PortalPagesHomePartialState,
  portal-pagesHomeInitialState,
} from './portal-portal-pages-home.reducer';
import * as PortalPagesHomeSelectors from './portal-portal-pages-home.selectors';

describe('PortalPagesHome Selectors', () => {
  let state: PortalPagesHomePartialState;

  beforeEach(() => {
    state = {
      portal-pagesHome: portal-pagesHomeInitialState
    };
  });

  describe('PortalPagesHome Selectors', () => {
    expect(state).toBeDefined();
  });
});
