import { Component, inject, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import type { LocaleId } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import type { GetTableProps } from '@dua-upd/utils-common';
import { PagesDetailsFacade } from '../+state/pages-details.facade';

type VisitorLocationColTypes = GetTableProps<
  PagesDetailsWebtrafficComponent,
  'visitorLocation$'
>;
type BarTableColTypes = GetTableProps<
  PagesDetailsWebtrafficComponent,
  'barTable$'
>;

type ActivityMapColTypes = GetTableProps<
  PagesDetailsWebtrafficComponent,
  'activityMap$'
>;

@Component({
  selector: 'upd-page-details-webtraffic',
  templateUrl: './pages-details-webtraffic.component.html',
  styleUrls: ['./pages-details-webtraffic.component.css'],
})
export class PagesDetailsWebtrafficComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);

  currentLang!: LocaleId;
  currentLang$ = this.i18n.currentLang$;

  apexBar$ = this.pageDetailsService.apexBar$;

  visitsByDay$ = this.pageDetailsService.visitsByDay$;

  visitorLocation$ = this.pageDetailsService.visitorLocation$;

  visitorLocationCols: ColumnConfig<VisitorLocationColTypes>[] = [];

  activityMap$ = this.pageDetailsService.activityMap$;
  activityMapCols: ColumnConfig<ActivityMapColTypes>[] = [];

  barTable$ = this.pageDetailsService.barTable$;
  barTableCols: ColumnConfig<BarTableColTypes>[] = [];

  dateRangeLabel$ = this.pageDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.pageDetailsService.comparisonDateRangeLabel$;

  ngOnInit() {
    this.i18n.service.onLangChange(({ lang }) => {
      this.currentLang = lang as LocaleId;
    });

    combineLatest([
      this.currentLang$,
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
    ]).subscribe(([lang, dateRange, comparisonDateRange]) => {
      this.visitorLocationCols = [
        {
          field: 'province',
          header: this.i18n.service.translate('province', lang),
        },
        {
          field: 'value',
          header: this.i18n.service.translate('visits', lang),
          pipe: 'number',
        },
        {
          field: 'change',
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

      this.activityMapCols = [
        {
          field: 'link',
          header: this.i18n.service.translate('link-text', lang),
        },
        {
          field: 'clicks',
          header: this.i18n.service.translate('clicks', lang),
          pipe: 'number',
        },
        {
          field: 'clicksChange',
          header: this.i18n.service.translate('change', lang),
          pipe: 'percent',
        },
      ];
    });
  }
}
