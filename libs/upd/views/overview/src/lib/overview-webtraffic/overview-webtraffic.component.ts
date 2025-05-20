import { Component, inject, OnInit } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { OverviewFacade } from '../+state/overview/overview.facade';
import { I18nFacade } from '@dua-upd/upd/state';
import { combineLatest } from 'rxjs';

@Component({
    selector: 'upd-overview-webtraffic',
    templateUrl: './overview-webtraffic.component.html',
    styleUrls: ['./overview-webtraffic.component.css'],
    standalone: false
})
export class OverviewWebtrafficComponent implements OnInit {
  private overviewService = inject(OverviewFacade);
  private i18n = inject(I18nFacade);
  currentLang$ = this.i18n.currentLang$;

  uniqueVisitors$ = this.overviewService.visitors$;
  uniqueVisitorsPercentChange$ = this.overviewService.visitorsPercentChange$;

  visits$ = this.overviewService.visits$;
  visitsPercentChange$ = this.overviewService.visitsPercentChange$;

  pageViews$ = this.overviewService.views$;
  pageViewsPercentChange$ = this.overviewService.viewsPercentChange$;

  apexBar$ = this.overviewService.apexBar$;
  annotationsData$ = this.overviewService.annotationsData$;

  topPagesWithChangeData$ =
    this.overviewService.topPagesVisitedWithPercentChange$;

  barTable$ = this.overviewService.barTable$;

  dateRangeLabel$ = this.overviewService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.overviewService.comparisonDateRangeLabel$;

  topPagesCols: ColumnConfig<{
    _id: string;
    url: string;
    visits: number;
    percentChange: number;
  }>[] = [];

  barTableCols: ColumnConfig<{
    date: string;
    visits: number;
    prevDate: string;
    prevVisits: number;
  }>[] = [];

  ngOnInit() {
    combineLatest([
      this.currentLang$,
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
    ]).subscribe(([lang, dateRange, comparisonDateRange]) => {
      this.topPagesCols = [
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
          pipe: 'percent',
        },
      ];

      this.barTableCols = [
        { field: 'date', header: this.i18n.service.translate('Dates', lang) },
        {
          field: 'visits',
          header: this.i18n.service.translate('Visits for ', lang, {
            value: dateRange,
          }),
          pipe: 'number',
        },
        {
          field: 'prevDate',
          header: this.i18n.service.translate('Dates', lang),
        },
        {
          field: 'prevVisits',
          header: this.i18n.service.translate('Visits for ', lang, {
            value: comparisonDateRange,
          }),
          pipe: 'number',
        },
      ];
    });
  }
}
