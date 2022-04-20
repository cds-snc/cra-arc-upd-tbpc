import { Component } from '@angular/core';
import { MultiSeries, SingleSeries } from '@amonsour/ngx-charts';
import { ColumnConfig } from '@cra-arc/upd-components';
import { I18nFacade } from '@cra-arc/upd/state';
import { OverviewFacade } from '../+state/overview/overview.facade';
import { EN_CA, LocaleId } from '@cra-arc/upd/i18n';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-overview-calldrivers',
  templateUrl: './overview-calldrivers.component.html',
  styleUrls: ['./overview-calldrivers.component.css'],
})
export class OverviewCalldriversComponent {
  currentLang!: LocaleId;
  currentLang$ = this.i18n.currentLang$;

  charts = [
    {
      Topic: 'Electronic Services',
      'Number of calls for Feb 27-Mar 05': '72,740',
      'Number of calls for Mar 06-Mar 12': '68,306',
    },
    {
      Topic: 'COVID-19',
      'Number of calls for Feb 27-Mar 05': '43,549',
      'Number of calls for Mar 06-Mar 12': '52,792',
    },
    {
      Topic: 'Account Maintenance',
      'Number of calls for Feb 27-Mar 05': '38,342',
      'Number of calls for Mar 06-Mar 12': '41,206',
    },
    {
      Topic: 'Print requests',
      'Number of calls for Feb 27-Mar 05': '27,230',
      'Number of calls for Mar 06-Mar 12': '26,128',
    },
    {
      Topic: 'Payments to the CRA',
      'Number of calls for Feb 27-Mar 05': '20,663',
      'Number of calls for Mar 06-Mar 12': '22,806',
    },
  ];

  dateRangeLabel$ = this.overviewService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.overviewService.comparisonDateRangeLabel$;

  constructor(
    private overviewService: OverviewFacade,
    private i18n: I18nFacade
  ) {}

  bar: MultiSeries = [];
  chartsCols: ColumnConfig[] = [];

  ngOnInit() {
    this.i18n.service.onLangChange(
      ({ lang }) => { this.currentLang = lang as LocaleId; }
    );

    combineLatest([this.currentLang$, this.dateRangeLabel$, this.comparisonDateRangeLabel$]).subscribe(([lang, dateRange, comparisonDateRange]) => {
      this.bar = [
        {
          name: 'Feb 27-Mar 05',
          series: [
            { name: this.i18n.service.translate('d3-benefits', lang), value: 27704 },
            { name: this.i18n.service.translate('d3-e-Services', lang), value: 275665 },
            { name: this.i18n.service.translate('d3-ITE', lang), value: 5887 },
            { name: this.i18n.service.translate('d3-c4', lang), value: 1208 },
            { name: this.i18n.service.translate('d3-be', lang), value: 87427 }
          ],
        },
        {
          name: 'Mar 06-Mar 12',
          series: [
            { name: this.i18n.service.translate('d3-benefits', lang), value: 22704 },
            { name: this.i18n.service.translate('d3-e-Services', lang), value: 289665 },
            { name: this.i18n.service.translate('d3-ITE', lang), value: 8757 },
            { name: this.i18n.service.translate('d3-c4', lang), value: 3208 },
            { name: this.i18n.service.translate('d3-be', lang), value: 65027 }
          ],
        },
      ];

      this.chartsCols = [
        { field: 'Topic', header: this.i18n.service.translate('topic', lang) },
        {
          field: this.i18n.service.translate('Number of calls for', lang, {value: ' Feb 27-Mar 05'}),
          header: this.i18n.service.translate('Number of calls for', lang, {value: ' Feb 27-Mar 05'})
        },
        {
          field: this.i18n.service.translate('Number of calls for', lang, {value: ' Mar 06-Mar 12'}),
          header: this.i18n.service.translate('Number of calls for', lang, {value: ' Mar 06-Mar 12'})
        },
      ];

    });
  }

}
