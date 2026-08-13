import { Component, computed, inject, OnInit } from '@angular/core';
import { map } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import type { PagesHomeAggregatedData } from '@dua-upd/types-common';
import { createCategoryConfig, type UnwrapSignal } from '@dua-upd/upd/utils';
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

  pagesHomeData = this.pagesHomeService.pagesHomeTableData;
  loading = this.pagesHomeService.loading;

  columns = computed<ColumnConfig<UnwrapSignal<typeof this.pagesHomeData>>[]>(
    () => {
      this.i18n.currentLang(); // trigger re-evaluation when language changes

      return [
        {
          field: 'title',
          header: 'Title',
          type: 'link',
          typeParam: '_id',
        },
        {
          field: 'pageArchiveStatusLabel',
          header: 'Current page status',
          type: 'label',
          typeParam: 'pageArchive',
          filterConfig: {
            type: 'category',
            categories: [
              { name: '404', value: '404' },
              {
                name: this.i18n.service.instant('Redirected'),
                value: 'Redirected',
              },
              { name: this.i18n.service.instant('Live'), value: 'Live' },
              {
                name: this.i18n.service.instant('Archived'),
                value: 'Archived',
              },
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
    },
  );

  searchFields = computed(() =>
    this.columns()
      .map((col) => col.field)
      .filter((field) => field !== 'visits'),
  );

  ngOnInit() {
    this.pagesHomeService.fetchData();
  }
}
