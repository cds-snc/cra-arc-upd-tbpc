import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import { PageArchivedStatus } from '@dua-upd/types-common';
import { PAGES_HOME_ACTIONS, PAGES_HOME_SELECTORS } from './pages-home.tokens';

@Injectable()
export class PagesHomeFacade {
  private readonly store = inject(Store);
  private readonly actions = inject(PAGES_HOME_ACTIONS);
  private readonly selectors = inject(PAGES_HOME_SELECTORS);

  loading$ = this.store.select(this.selectors.selectPagesHomeLoading);
  loaded$ = this.store.select(this.selectors.selectPagesHomeLoaded);
  pagesHomeData$ = this.store.select(this.selectors.selectPagesHomeData);

  pagesHomeTableData$ = this.pagesHomeData$.pipe(
    map((pagesHomeData) =>
      [...(pagesHomeData?.dateRangeData || [])].map((d) => ({
        ...d,
        pageArchivedStatusLabel: [
          ...(d.pageStatus ? [d.pageStatus] : []),
          ...(d.archivedStatus ? [d.archivedStatus] : []),
        ] satisfies PageArchivedStatus[],
      })),
    ),
  );
  error$ = this.store.select(this.selectors.selectPagesHomeError);

  fetchData() {
    this.store.dispatch(this.actions.loadPagesHomeInit());
  }
}
