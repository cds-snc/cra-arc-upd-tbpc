import { Component, inject, OnInit } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { TasksDetailsFacade } from '../+state/tasks-details.facade';
import { EN_CA } from '@dua-upd/upd/i18n';

@Component({
    selector: 'upd-task-details-search-analytics',
    templateUrl: './task-details-search-analytics.component.html',
    styleUrls: ['./task-details-search-analytics.component.css'],
    standalone: false
})
export class TaskDetailsSearchAnalyticsComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly taskDetailsService = inject(TasksDetailsFacade);

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

  gscTotalClicks$ = this.taskDetailsService.gscTotalClicks$;

  gscTotalImpressions$ = this.taskDetailsService.gscTotalImpressions$;
  gscTotalImpressionsPercentChange$ =
    this.taskDetailsService.gscTotalImpressionsPercentChange$;
  gscTotalCtr$ = this.taskDetailsService.gscTotalCtr$;
  gscTotalCtrPercentChange$ = this.taskDetailsService.gscTotalCtrPercentChange$;
  gscTotalPosition$ = this.taskDetailsService.gscTotalPosition$;
  gscTotalPositionPercentChange$ =
    this.taskDetailsService.gscTotalPositionPercentChange$;

  visitsByPage$ = this.taskDetailsService.visitsByPage$;
  visitsByPageCols: ColumnConfig[] = [];

  topSearchTerms$ = this.taskDetailsService.topSearchTerms$;

  searchTermsColConfig$ = this.taskDetailsService.searchTermsColConfig$;

  ngOnInit() {
    this.currentLang$.subscribe((lang) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';
      this.visitsByPageCols = [
        {
          field: 'title',
          header: this.i18n.service.translate('Title', lang),
          type: 'link',
          typeParams: { preLink: '/' + this.langLink + '/pages', link: '_id' },
        },
        {
          field: 'url',
          header: this.i18n.service.translate('URL', lang),
          type: 'link',
          typeParams: { preLink: '/' + this.langLink + '/pages', link: '_id' },
        },
        {
          field: 'gscTotalClicks',
          header: this.i18n.service.translate('clicks', lang),
          pipe: 'number',
          type: 'link',
          typeParams: {
            preLink: '/' + this.langLink + '/pages',
            link: '_id',
            postLink: 'searchanalytics',
          },
        },
        {
          field: 'gscTotalImpressions',
          header: this.i18n.service.translate('impressions', lang),
          pipe: 'number',
          type: 'link',
          typeParams: {
            preLink: '/' + this.langLink + '/pages',
            link: '_id',
            postLink: 'searchanalytics',
          },
        },
        {
          field: 'gscTotalCtr',
          header: this.i18n.service.translate('ctr', lang),
          pipe: 'percent',
        },
        {
          field: 'gscTotalPosition',
          header: this.i18n.service.translate('position', lang),
          pipe: 'number',
        },
        // { field: 'percentChange', header: this.i18n.service.translate('comparison-for-clicks', lang), pipe: 'percent' },
      ];
    });
  }
}
