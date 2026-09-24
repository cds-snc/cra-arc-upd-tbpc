import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { NxModule } from '@nx/angular';
import { hot } from 'jasmine-marbles';
import { Observable } from 'rxjs';

import * as PortalPagesDetailsActions from './portal-portal-pages-details.actions';
import { PortalPagesDetailsEffects } from './portal-portal-pages-details.effects';

describe('PortalPagesDetailsEffects', () => {
  let actions: Observable<Action>;
  let effects: PortalPagesDetailsEffects;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NxModule.forRoot()],
      providers: [
        PortalPagesDetailsEffects,
        provideMockActions(() => actions),
        provideMockStore(),
      ],
    });

    effects = TestBed.inject(PortalPagesDetailsEffects);
  });

  describe('init$', () => {
    it('should work', () => {
      actions = hot('-a-|', { a: PortalPagesDetailsActions.loadPortalPagesDetailsInit() });

      const expected = hot('-a-|', {
        a: PortalPagesDetailsActions.loadPortalPagesDetailsSuccess({ portal-pagesDetails: [] }),
      });

      expect(effects.init$).toBeObservable(expected);
    });
  });
});
