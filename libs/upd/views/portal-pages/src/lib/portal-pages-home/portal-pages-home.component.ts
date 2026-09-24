import { Component, inject, OnInit } from '@angular/core';
import { map } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import type { PortalPagesHomeAggregatedData } from '@dua-upd/types-common';
import { createCategoryConfig } from '@dua-upd/upd/utils';
import { PortalPagesHomeFacade } from './+state/portal-pages-home.facade';

@Component({
    selector: 'upd-portal-pages-home',
    templateUrl: './portal-pages-home.component.html',
    styleUrls: ['./portal-pages-home.component.css'],
    standalone: false
})
export class PortalPagesHomeComponent implements OnInit {
  private portalPagesHomeService = inject(PortalPagesHomeFacade);
  private i18n = inject(I18nFacade);

  portalPagesHomeData$ = this.portalPagesHomeService.portalPagesHomeTableData$;
  loading$ = this.portalPagesHomeService.loading$;

  currentLang$ = this.i18n.currentLang$;

  columns = this.portalPagesHomeData$.pipe(
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
            field: 'screen_id',
            header: 'Screen ID',
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
        ] as ColumnConfig<PortalPagesHomeAggregatedData>[],
    ),
  );

  searchFields = this.columns.pipe(
    map((columns) => columns.map((col) => col.field)),
  );

  ngOnInit() {
    this.portalPagesHomeService.fetchData();
  }
}
