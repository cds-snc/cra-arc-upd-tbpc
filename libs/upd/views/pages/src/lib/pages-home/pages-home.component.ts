import { Component, inject, OnInit } from '@angular/core';
import { map } from 'rxjs';
import { labelColumn, type ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import type { PagesHomeAggregatedData } from '@dua-upd/types-common';
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
  private readonly pageLabelColumn = labelColumn<PagesHomeAggregatedData>();

  columns = this.pagesHomeData$.pipe(
    map(
      () =>
        [
          {
            field: 'title',
            header: 'Title',
            type: 'link',
            link: '_id',
          },
          this.pageLabelColumn({
            field: 'pageArchiveStatusLabel',
            header: 'Current page status',
            type: 'label',
            labelTypes: ['pageStatus', 'archiveStatus'],
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
          }),
          {
            field: 'url',
            header: 'URL',
            type: 'link',
            link: 'url',
            external: true,
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
