import { Component, inject, OnInit } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import type { UnwrapObservable } from '@dua-upd/upd/utils';
import { PagesHomeFacade } from './+state/pages-home.facade';

@Component({
  selector: 'upd-pages-home',
  templateUrl: './pages-home.component.html',
  styleUrls: ['./pages-home.component.css'],
  standalone: false,
})
export class PagesHomeComponent implements OnInit {
  private pagesHomeService = inject(PagesHomeFacade);
  private i18n = inject(I18nFacade);

  pagesHomeData$ = this.pagesHomeService.pagesHomeTableData$;
  loading$ = this.pagesHomeService.loading$;

  currentLang$ = this.i18n.currentLang$;

  columns: ColumnConfig<UnwrapObservable<typeof this.pagesHomeData$>>[] = [
    {
      field: 'title',
      header: 'Title',
      type: 'link',
      typeParam: '_id',
    },
    {
      field: 'pageArchivedStatusLabel',
      header: 'Page status',
      type: 'label',
      typeParam: 'pageArchived',
      filterConfig: {
        type: 'pageArchivedStatus',
        categories: [
          { name: '404', value: '404' },
          { name: 'Redirected', value: 'Redirected' },
          { name: 'Live', value: 'Live' },
          { name: 'Archived', value: 'Archived' },
          { name: 'Not archived', value: 'Not archived' },
        ],
        matchMode: 'arrayContains',
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
  ];

  searchFields = this.columns.map((col) => col.field);

  ngOnInit() {
    this.pagesHomeService.fetchData();
  }
}
