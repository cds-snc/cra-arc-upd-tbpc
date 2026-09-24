import { Action } from '@ngrx/store';

import * as PortalPagesDetailsActions from './portal-portal-pages-details.actions';
import { PortalPagesDetailsEntity } from './portal-portal-pages-details.models';
import { State, portal-pagesDetailsInitialState, reducer } from './portal-portal-pages-details.reducer';

describe('PortalPagesDetails Reducer', () => {
  const createPortalPagesDetailsEntity = (
    id: string,
    name = ''
  ): PortalPagesDetailsEntity => ({
    id,
    name: name || `name-${id}`,
  });

  describe('valid PortalPagesDetails actions', () => {
    it('loadPortalPagesDetailsSuccess should return the list of known PortalPagesDetails', () => {
      const portal-pagesDetails = [
        createPortalPagesDetailsEntity('PRODUCT-AAA'),
        createPortalPagesDetailsEntity('PRODUCT-zzz'),
      ];
      const action = PortalPagesDetailsActions.loadPortalPagesDetailsSuccess({
        portal-pagesDetails,
      });

      const result: State = reducer(portal-pagesDetailsInitialState, action);

      expect(result.loaded).toBe(true);
      expect(result.ids.length).toBe(2);
    });
  });

  describe('unknown action', () => {
    it('should return the previous state', () => {
      const action = {} as Action;

      const result = reducer(portal-pagesDetailsInitialState, action);

      expect(result).toBe(portal-pagesDetailsInitialState);
    });
  });
});
