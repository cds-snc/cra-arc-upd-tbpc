import { NgModule } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule, Store } from '@ngrx/store';
import { NxModule } from '@nx/angular';
import { readFirst } from '@nx/angular/testing';

import * as PortalPagesDetailsActions from './portal-portal-pages-details.actions';
import { PortalPagesDetailsEffects } from './portal-portal-pages-details.effects';
import { PortalPagesDetailsFacade } from './portal-portal-pages-details.facade';
import { PortalPagesDetailsEntity } from './portal-portal-pages-details.models';
import {
  PORTAL_PAGES_DETAILS_FEATURE_KEY,
  State,
  portal-pagesDetailsInitialState,
  reducer,
} from './portal-portal-pages-details.reducer';
import * as PortalPagesDetailsSelectors from './portal-portal-pages-details.selectors';

interface TestSchema {
  portal-pagesDetails: State;
}

describe('PortalPagesDetailsFacade', () => {
  let facade: PortalPagesDetailsFacade;
  let store: Store<TestSchema>;
  const createPortalPagesDetailsEntity = (
    id: string,
    name = ''
  ): PortalPagesDetailsEntity => ({
    id,
    name: name || `name-${id}`,
  });

  describe('used in NgModule', () => {
    beforeEach(() => {
      @NgModule({
        imports: [
          StoreModule.forFeature(PORTAL_PAGES_DETAILS_FEATURE_KEY, reducer),
          EffectsModule.forFeature([PortalPagesDetailsEffects]),
        ],
        providers: [PortalPagesDetailsFacade],
      })
      class CustomFeatureModule {}

      @NgModule({
        imports: [
          NxModule.forRoot(),
          StoreModule.forRoot({}),
          EffectsModule.forRoot([]),
          CustomFeatureModule,
        ],
      })
      class RootModule {}
      TestBed.configureTestingModule({ imports: [RootModule] });

      store = TestBed.inject(Store);
      facade = TestBed.inject(PortalPagesDetailsFacade);
    });

    /**
     * The initially generated facade::loadAll() returns empty array
     */
    it('loadAll() should return empty list with loaded == true', async () => {
      let list = await readFirst(facade.allPortalPagesDetails$);
      let isLoaded = await readFirst(facade.loaded$);

      expect(list.length).toBe(0);
      expect(isLoaded).toBe(false);

      facade.init();

      list = await readFirst(facade.allPortalPagesDetails$);
      isLoaded = await readFirst(facade.loaded$);

      expect(list.length).toBe(0);
      expect(isLoaded).toBe(true);
    });

    /**
     * Use `loadPortalPagesDetailsSuccess` to manually update list
     */
    it('allPortalPagesDetails$ should return the loaded list; and loaded flag == true', async () => {
      let list = await readFirst(facade.allPortalPagesDetails$);
      let isLoaded = await readFirst(facade.loaded$);

      expect(list.length).toBe(0);
      expect(isLoaded).toBe(false);

      store.dispatch(
        PortalPagesDetailsActions.loadPortalPagesDetailsSuccess({
          portal-pagesDetails: [
            createPortalPagesDetailsEntity('AAA'),
            createPortalPagesDetailsEntity('BBB'),
          ],
        })
      );

      list = await readFirst(facade.allPortalPagesDetails$);
      isLoaded = await readFirst(facade.loaded$);

      expect(list.length).toBe(2);
      expect(isLoaded).toBe(true);
    });
  });
});
