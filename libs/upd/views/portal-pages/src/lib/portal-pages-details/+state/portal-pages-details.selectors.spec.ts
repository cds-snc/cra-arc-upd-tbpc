import { PortalPagesDetailsEntity } from './portal-portal-pages-details.models';
import {
  portal-pagesDetailsAdapter,
  PortalPagesDetailsPartialState,
  portal-pagesDetailsInitialState,
} from './portal-portal-pages-details.reducer';
import * as PortalPagesDetailsSelectors from './portal-portal-pages-details.selectors';

describe('PortalPagesDetails Selectors', () => {
  const ERROR_MSG = 'No Error Available';
  const getPortalPagesDetailsId = (it: PortalPagesDetailsEntity) => it.id;
  const createPortalPagesDetailsEntity = (id: string, name = '') =>
    ({
      id,
      name: name || `name-${id}`,
    } as PortalPagesDetailsEntity);

  let state: PortalPagesDetailsPartialState;

  beforeEach(() => {
    state = {
      portal-pagesDetails: portal-pagesDetailsAdapter.setAll(
        [
          createPortalPagesDetailsEntity('PRODUCT-AAA'),
          createPortalPagesDetailsEntity('PRODUCT-BBB'),
          createPortalPagesDetailsEntity('PRODUCT-CCC'),
        ],
        {
          ...portal-pagesDetailsInitialState,
          selectedId: 'PRODUCT-BBB',
          error: ERROR_MSG,
          loaded: true,
        }
      ),
    };
  });

  describe('PortalPagesDetails Selectors', () => {
    it('getAllPortalPagesDetails() should return the list of PortalPagesDetails', () => {
      const results = PortalPagesDetailsSelectors.getAllPortalPagesDetails(state);
      const selId = getPortalPagesDetailsId(results[1]);

      expect(results.length).toBe(3);
      expect(selId).toBe('PRODUCT-BBB');
    });

    it('getSelected() should return the selected Entity', () => {
      const result = PortalPagesDetailsSelectors.getSelected(
        state
      ) as PortalPagesDetailsEntity;
      const selId = getPortalPagesDetailsId(result);

      expect(selId).toBe('PRODUCT-BBB');
    });

    it('getPortalPagesDetailsLoaded() should return the current "loaded" status', () => {
      const result = PortalPagesDetailsSelectors.selectPortalPagesDetailsLoaded(state);

      expect(result).toBe(true);
    });

    it('getPortalPagesDetailsError() should return the current "error" state', () => {
      const result = PortalPagesDetailsSelectors.selectPortalPagesDetailsError(state);

      expect(result).toBe(ERROR_MSG);
    });
  });
});
