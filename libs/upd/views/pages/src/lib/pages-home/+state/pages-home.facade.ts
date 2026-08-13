import { computed, inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as PagesHomeActions from './pages-home.actions';
import * as PagesHomeSelectors from './pages-home.selectors';
import { map } from 'rxjs';

@Injectable()
export class PagesHomeFacade {
  private readonly store = inject(Store);

  loading = this.store.selectSignal(PagesHomeSelectors.selectPagesHomeLoading);
  pagesHomeData = this.store.selectSignal(
    PagesHomeSelectors.selectPagesHomeData,
  );

  pagesHomeTableData = computed(() =>
    (this.pagesHomeData()?.dateRangeData || []).map((d) => ({
      ...d,
      pageArchiveStatusLabel: [
        ...(d.pageStatus ? [d.pageStatus] : []),
        ...(d.is_archived ? (['Archived'] as const) : []),
      ],
    })),
  );

  error = this.store.selectSignal(PagesHomeSelectors.selectPagesHomeError);

  fetchData() {
    this.store.dispatch(PagesHomeActions.loadPagesHomeInit());
  }
}
