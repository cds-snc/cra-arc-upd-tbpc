import { Component, inject, OnInit } from '@angular/core';
import { map } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import type { PagesHomeAggregatedData } from '@dua-upd/types-common';
import { createCategoryConfig } from '@dua-upd/upd/utils';
import { PagesHomeFacade } from './+state/pages-home.facade';

@Component({
    selector: 'upd-pages-home',
    templateUrl: './pages-home.component.html',
    styleUrls: ['./pages-home.component.css'],
    standalone: false
})
export class PagesHomeComponent implements OnInit {
  private pagesHomeService = inject(PagesHomeFacade);
  private i18n = inject(I18nFacade);

  pagesHomeData$ = this.pagesHomeService.pagesHomeTableData$;
  loading$ = this.pagesHomeService.loading$;

  currentLang$ = this.i18n.currentLang$;

  columns = this.pagesHomeData$.pipe(
    map(
      (data) =>
        [
          {
            field: 'title',
            header: 'Title',
            type: 'link',
            typeParam: '_id',
          },
          {
            field: 'pageStatus',
            header: 'Current status',
            type: 'label',
            typeParam: 'pageStatus',
            filterConfig: {
              type: 'pageStatus',
              categories: createCategoryConfig({
                i18n: this.i18n.service,
                data,
                field: 'pageStatus',
              }),
            },
          },
          {
            field: 'url',
            header: 'URL',
            type: 'link',
            typeParams: { link: 'url', external: true },
          },
          {
            field: 'visits',
            header: 'visits',
            pipe: 'number',
          },
        ] as ColumnConfig<PagesHomeAggregatedData>[],
    ),
  );

  searchFields = this.columns.pipe(
    map((columns) => columns.map((col) => col.field)),
  );

  ngOnInit() {
    this.pagesHomeService.fetchData();
  }
}
