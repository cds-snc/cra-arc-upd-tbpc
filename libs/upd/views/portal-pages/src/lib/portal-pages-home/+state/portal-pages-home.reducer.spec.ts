import { Action } from '@ngrx/store';

import * as PortalPagesHomeActions from './portal-portal-pages-home.actions';
import { PortalPagesHomeEntity } from './portal-portal-pages-home.models';
import { State, portal-pagesHomeInitialState, reducer } from './portal-portal-pages-home.reducer';

describe('PortalPagesHome Reducer', () => {
  const createPortalPagesHomeEntity = (id: string, name = ''): PortalPagesHomeEntity => ({
    id,
    name: name || `name-${id}`,
  });

  describe('valid PortalPagesHome actions', () => {
    it('loadPortalPagesHomeSuccess should return the list of known PortalPagesHome', () => {
      const portal-pagesHome = [
        createPortalPagesHomeEntity('PRODUCT-AAA'),
        createPortalPagesHomeEntity('PRODUCT-zzz'),
      ];
      const action = PortalPagesHomeActions.loadPortalPagesHomeSuccess({ portal-pagesHome });

      const result: State = reducer(portal-pagesHomeInitialState, action);

      expect(result.loaded).toBe(true);
      expect(result.ids.length).toBe(2);
    });
  });

  describe('unknown action', () => {
    it('should return the previous state', () => {
      const action = {} as Action;

      const result = reducer(portal-pagesHomeInitialState, action);

      expect(result).toBe(portal-pagesHomeInitialState);
    });
  });
});
