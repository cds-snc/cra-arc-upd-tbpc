import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import {
  callVolumeObjectiveCriteria,
  feedbackKpiObjectiveCriteria,
} from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import type { ColumnConfig } from '@dua-upd/types-common';
import { EN_CA } from '@dua-upd/upd/i18n';
import { TasksDetailsFacade } from '../+state/tasks-details.facade';
import { createCategoryConfig } from '@dua-upd/upd/utils';
import { combineLatest, map } from 'rxjs';

@Component({
    selector: 'upd-task-details-summary',
    templateUrl: './task-details-summary.component.html',
    styleUrls: ['./task-details-summary.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class TaskDetailsSummaryComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly taskDetailsService = inject(TasksDetailsFacade);

  avgTaskSuccessFromLastTest$ =
    this.taskDetailsService.avgTaskSuccessFromLastTest$;
  avgSuccessPercentChange$ = this.taskDetailsService.avgSuccessPercentChange$;
  avgSuccessValueChange$ = this.taskDetailsService.avgSuccessValueChange$;
  dateFromLastTest$ = this.taskDetailsService.dateFromLastTest$;

  visits$ = this.taskDetailsService.visits$;
  visitsPercentChange$ = this.taskDetailsService.visitsPercentChange$;

  feedbackKpiObjectiveCriteria = feedbackKpiObjectiveCriteria;

  apexCallDrivers$ = this.taskDetailsService.apexCallDrivers$;
  apexKpiFeedback$ = this.taskDetailsService.apexKpiFeedback$;

  callPerVisits$ = this.taskDetailsService.callPerVisits$;
  apexCallPercentChange$ = this.taskDetailsService.apexCallPercentChange$;
  apexCallDifference$ = this.taskDetailsService.apexCallDifference$;

  currentKpiFeedback$ = this.taskDetailsService.currentKpiFeedback$;
  kpiFeedbackPercentChange$ = this.taskDetailsService.kpiFeedbackPercentChange$;
  kpiFeedbackDifference$ = this.taskDetailsService.kpiFeedbackDifference$;

  currentCallVolume$ = this.taskDetailsService.currentCallVolume$;
  callPercentChange$ = this.taskDetailsService.callPercentChange$;

  visitsByPage$ = this.taskDetailsService.visitsByPage$;

  dyfChart$ = this.taskDetailsService.dyfData$;

  taskSuccessByUxTest$ = this.taskDetailsService.taskSuccessByUxTest$;
  taskSuccessByUxTestCols: ColumnConfig[] = [];

  callVolumeObjectiveCriteria = callVolumeObjectiveCriteria;
  callVolumeKpiConfig = {
    pass: { message: 'kpi-met-volume' },
    fail: { message: 'kpi-not-met-volume' },
  };

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

  fullDateRangeLabel$ = this.taskDetailsService.fullDateRangeLabel$;
  fullComparisonDateRangeLabel$ =
    this.taskDetailsService.fullComparisonDateRangeLabel$;

  visitsByPageCols: ColumnConfig[] = [];
  dyfTableCols: ColumnConfig<{
    name: string;
    currValue: number;
    prevValue: string;
  }>[] = [];

  dyfChartApex$ = this.taskDetailsService.dyfDataApex$;
  dyfChartLegend: string[] = [];

  dateRangeLabel$ = this.taskDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.taskDetailsService.comparisonDateRangeLabel$;

  avgTaskSuccessKpiCriteria = (successRate: number) =>
    successRate >= 0.8 ? 'pass' : 'fail';

  hasTopicIds$ = this.taskDetailsService.hasTopicIds$;

  callsEmptyMessages$ = this.hasTopicIds$.pipe(
    map((hasTopicIds) =>
      hasTopicIds === false ? 'nocall-drivers-mapped' : 'nodata-available',
    ),
  );

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    combineLatest([
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
      this.visitsByPage$,
      this.currentLang$,
    ]).subscribe(([dateRange, comparisonDateRange, data, lang]) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';

      this.dyfChartLegend = [
        this.i18n.service.translate('yes', lang),
        this.i18n.service.translate('no', lang),
      ];

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
            categories: data
              ? createCategoryConfig({
                  i18n: this.i18n.service,
                  data,
                  field: 'language',
                })
              : undefined,
          },
        },
        {
          field: 'pageStatus',
          header: 'Page status',
          type: 'label',
          typeParam: 'pageStatus',
          filterConfig: {
            type: 'pageStatus',
            categories: data
              ? createCategoryConfig({
                  i18n: this.i18n.service,
                  data,
                  field: 'pageStatus',
                })
              : undefined,
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
          field: 'visitsPercentChange',
          header: this.i18n.service.translate('change', lang),
          pipe: 'percent',
          type: 'comparison',
        },
      ];

      this.taskSuccessByUxTestCols = [
        {
          field: 'title',
          header: this.i18n.service.translate('ux-test', lang),
          type: 'link',
          typeParams: {
            preLink: '/' + this.langLink + '/projects',
            link: '_project_id',
          },
        },
        {
          field: 'date',
          header: this.i18n.service.translate('date', lang),
          pipe: 'date',
        },
        {
          field: 'test_type',
          header: this.i18n.service.translate('test-type', lang),
        },
        {
          field: 'scenario',
          header: this.i18n.service.translate('Scenario', lang),
        },
        {
          field: 'success_rate',
          header: this.i18n.service.translate('success-rate', lang),
          pipe: 'percent',
        },
      ];

      this.dyfTableCols = [
        {
          field: 'name',
          header: this.i18n.service.translate('Selection', lang),
        },
        {
          field: 'currValue',
          header: dateRange,
          pipe: 'number',
        },
        {
          field: 'prevValue',
          header: comparisonDateRange,
          pipe: 'number',
        },
      ];
    });
  }
}
