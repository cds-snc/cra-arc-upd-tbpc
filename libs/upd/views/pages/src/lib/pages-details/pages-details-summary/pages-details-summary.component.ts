import { Component, computed, inject, Signal, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EN_CA } from '@dua-upd/upd/i18n';
import { feedbackKpiObjectiveCriteria } from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import type { ColumnConfig } from '@dua-upd/types-common';
import type { GetTableProps } from '@dua-upd/utils-common';
import { PagesDetailsFacade } from '../+state/pages-details.facade';

type TasksTableColTypes = GetTableProps<PagesDetailsSummaryComponent, 'tasks$'>;
type BarTableColTypes = GetTableProps<
  PagesDetailsSummaryComponent,
  'barTable$'
>;
type VisitsByDeviceColTypes = GetTableProps<
  PagesDetailsSummaryComponent,
  'visitsByDeviceTypeTable$'
>;

@Component({
    selector: 'upd-page-details-summary',
    templateUrl: './pages-details-summary.component.html',
    styleUrls: ['./pages-details-summary.component.css'],
    standalone: false
})
export class PagesDetailsSummaryComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);

  currentLang = this.i18n.currentLang;

  data$ = this.pageDetailsService.pagesDetailsData$;
  error$ = this.pageDetailsService.error$;

  visits = toSignal(this.pageDetailsService.visits$) as () => number;

  apexKpiFeedback$ = this.pageDetailsService.apexKpiFeedback$;

  currentKpiFeedback$ = this.pageDetailsService.currentKpiFeedback$;
  kpiFeedbackPercentChange$ = this.pageDetailsService.kpiFeedbackPercentChange$;
  feedbackKpiObjectiveCriteria = feedbackKpiObjectiveCriteria;
  kpiFeedbackDifference$ = this.pageDetailsService.kpiFeedbackDifference$;

  visitors$ = this.pageDetailsService.visitors$;
  visitorsPercentChange$ = this.pageDetailsService.visitorsPercentChange$;

  visitsPercentChange$ = this.pageDetailsService.visitsPercentChange$;

  pageViews$ = this.pageDetailsService.pageViews$;
  pageViewsPercentChange$ = this.pageDetailsService.pageViewsPercentChange$;

  visitsByDay$ = this.pageDetailsService.visitsByDay$;

  visitsByDeviceType$ = this.pageDetailsService.visitsByDeviceType$;

  topSearchTermsIncrease$ = this.pageDetailsService.topSearchTermsIncrease$;

  topSearchTermsDecrease$ = this.pageDetailsService.topSearchTermsDecrease$;

  tasks$ = this.pageDetailsService.tasks$;

  dateRangeLabel = toSignal(this.pageDetailsService.dateRangeLabel$);
  comparisonDateRangeLabel = toSignal(
    this.pageDetailsService.comparisonDateRangeLabel$,
  );

  apexBar$ = this.pageDetailsService.apexBar$;
  barTable$ = this.pageDetailsService.barTable$;

  apexVisitsByDeviceTypeChart$ =
    this.pageDetailsService.apexVisitsByDeviceTypeChart$;
  apexVisitsByDeviceTypeLabels$ =
    this.pageDetailsService.apexVisitsByDeviceTypeLabels$;

  visitsByDeviceTypeTable$ = this.pageDetailsService.visitsByDeviceTypeTable$;
  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));

  topSearchTermsCols: ColumnConfig[] = [
    {
      field: 'term',
      header: 'search-term',
    },
    {
      field: 'impressions',
      header: 'impressions',
      pipe: 'number',
      pipeParam: '1.0-2',
    },
    {
      field: 'change',
      header: 'change',
      pipe: 'percent',
    },
    {
      field: 'ctr',
      header: 'ctr',
      pipe: 'percent',
    },
    {
      field: 'position',
      header: 'position',
      pipe: 'number',
      pipeParam: '1.0-2',
    },
  ];

  barTableCols: Signal<ColumnConfig<BarTableColTypes>[]> = computed(() => [
    {
      field: 'date',
      header: 'Dates',
    },
    {
      field: 'visits',
      header: this.i18n.service.translate('Visits for ', this.currentLang(), {
        value: this.dateRangeLabel(),
      }),
      pipe: 'number',
    },
    {
      field: 'prevDate',
      header: 'Dates',
    },
    {
      field: 'prevVisits',
      header: this.i18n.service.translate('Visits for ', this.currentLang(), {
        value: this.comparisonDateRangeLabel(),
      }),
      pipe: 'number',
    },
  ]);

  visitsByDeviceTypeCols: Signal<ColumnConfig<VisitsByDeviceColTypes>[]> =
    computed(() => [
      {
        field: 'name',
        header: this.i18n.service.translate('Device Type', this.currentLang()),
      },
      {
        field: 'currValue',
        header: this.dateRangeLabel() || '',
        pipe: 'number',
      },
      {
        field: 'prevValue',
        header: this.comparisonDateRangeLabel() || '',
        pipe: 'number',
      },
    ]);

  tasksCols: Signal<ColumnConfig<TasksTableColTypes>[]> = computed(() => [
    {
      field: 'title',
      header: this.i18n.service.translate('Task', this.currentLang()),
      type: 'link',
      translate: true,
      typeParams: {
        preLink: '/' + this.langLink() + '/tasks',
        link: '_id',
      },
    },
  ]);

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
