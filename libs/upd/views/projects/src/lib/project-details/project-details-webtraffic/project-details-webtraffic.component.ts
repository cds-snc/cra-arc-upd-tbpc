import { Component, inject, OnInit } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';
import { EN_CA } from '@dua-upd/upd/i18n';
import { createCategoryConfig } from '@dua-upd/upd/utils';
import { combineLatest } from 'rxjs';

@Component({
    selector: 'upd-project-details-webtraffic',
    templateUrl: './project-details-webtraffic.component.html',
    styleUrls: ['./project-details-webtraffic.component.css'],
    standalone: false
})
export class ProjectDetailsWebtrafficComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  langLink = 'en';

  visits$ = this.projectsDetailsService.visits$;
  visitsPercentChange$ = this.projectsDetailsService.visitsPercentChange$;

  visitsByPage$ = this.projectsDetailsService.visitsByPageWithPercentChange$;
  visitsByPageCols: ColumnConfig[] = [];

  ngOnInit() {
    combineLatest([this.visitsByPage$, this.i18n.currentLang$]).subscribe(
      ([data, lang]) => {
        this.langLink = lang === EN_CA ? 'en' : 'fr';
        this.visitsByPageCols = [
          {
            field: 'title',
            header: this.i18n.service.translate('page-title', lang),
            type: 'link',
            typeParams: {
              preLink: '/' + this.langLink + '/pages',
              link: '_id',
            },
          },
          {
            field: 'language',
            header: this.i18n.service.translate('Search term language', lang),
            filterConfig: {
              type: 'category',
              categories: createCategoryConfig({
                i18n: this.i18n.service,
                data,
                field: 'language',
              }),
            },
          },
          {
            field: 'pageStatus',
            header: 'Page status',
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
            header: this.i18n.service.translate('URL', lang),
            type: 'link',
            typeParams: { link: 'url', external: true },
          },
          {
            field: 'visits',
            header: this.i18n.service.translate('visits', lang),
            pipe: 'number',
          },
          {
            field: 'percentChange',
            header: this.i18n.service.translate('change', lang),
            type: 'comparison',
            pipe: 'percent',
          },
        ];
      },
    );
  }
}
