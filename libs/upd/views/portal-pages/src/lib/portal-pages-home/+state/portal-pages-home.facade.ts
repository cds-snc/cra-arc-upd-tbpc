import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as PortalPagesHomeActions from './portal-pages-home.actions';
import * as PortalPagesHomeSelectors from './portal-pages-home.selectors';
import { map } from 'rxjs';

@Injectable()
export class PortalPagesHomeFacade {
  private readonly store = inject(Store);

  loading$ = this.store.select(PortalPagesHomeSelectors.selectPortalPagesHomeLoading);
  loaded$ = this.store.select(PortalPagesHomeSelectors.selectPortalPagesHomeLoaded);
  portalPagesHomeData$ = this.store.select(PortalPagesHomeSelectors.selectPortalPagesHomeData);
  portalPagesHomeTableData$ = this.portalPagesHomeData$.pipe(
    map((portalPagesHomeData) => [...(portalPagesHomeData?.dateRangeData || [])]),
  );
  error$ = this.store.select(PortalPagesHomeSelectors.selectPortalPagesHomeError);

  fetchData() {
    this.store.dispatch(PortalPagesHomeActions.loadPortalPagesHomeInit());
  }
}
