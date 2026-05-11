import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { combineLatest, map } from 'rxjs';
import {
  callVolumeObjectiveCriteria,
  feedbackKpiObjectiveCriteria,
} from '@dua-upd/upd-components';
import { EN_CA } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import type { ColumnConfig } from '@dua-upd/types-common';
import type { GetTableProps } from '@dua-upd/utils-common';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';

type ParticipantTasksColTypes = GetTableProps<
  ProjectDetailsSummaryComponent,
  'participantTasks$'
>;

type DocumentsColTypes = GetTableProps<
  ProjectDetailsSummaryComponent,
  'documents$'
>;

@Component({
    selector: 'upd-project-details-summary',
    templateUrl: './project-details-summary.component.html',
    styleUrls: ['./project-details-summary.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ProjectDetailsSummaryComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

  fullDateRangeLabel$ = this.projectsDetailsService.fullDateRangeLabel$;
  fullComparisonDateRangeLabel$ =
    this.projectsDetailsService.fullComparisonDateRangeLabel$;

  documents$ = this.projectsDetailsService.documents$;
  documentsCols: ColumnConfig<DocumentsColTypes>[] = [];

  baselineTestData$ = this.projectsDetailsService.baselineTestData$;
  validationTestData$ = this.projectsDetailsService.validationTestData$;
  taskSuccessChange$ = this.projectsDetailsService.taskSuccessChange$;

  feedbackKpiObjectiveCriteria = feedbackKpiObjectiveCriteria;

  apexCallDrivers$ = this.projectsDetailsService.apexCallDrivers$;
  apexKpiFeedback$ = this.projectsDetailsService.apexKpiFeedback$;

  callPerVisits$ = this.projectsDetailsService.callPerVisits$;
  apexCallPercentChange$ = this.projectsDetailsService.apexCallPercentChange$;
  apexCallDifference$ = this.projectsDetailsService.apexCallDifference$;

  currentKpiFeedback$ = this.projectsDetailsService.currentKpiFeedback$;
  kpiFeedbackPercentChange$ =
    this.projectsDetailsService.kpiFeedbackPercentChange$;
  kpiFeedbackDifference$ = this.projectsDetailsService.kpiFeedbackDifference$;

  visits$ = this.projectsDetailsService.visits$;
  visitsPercentChange$ = this.projectsDetailsService.visitsPercentChange$;

  participantTasks$ = this.projectsDetailsService.projectTasks$;

  dyfChart$ = this.projectsDetailsService.dyfData$;

  dyfChartApex$ = this.projectsDetailsService.dyfDataApex$;
  dyfChartLegend: string[] = [];

  totalCalldriver$ = this.projectsDetailsService.totalCalldriver$;
  totalCalldriverPercentChange$ =
    this.projectsDetailsService.totalCalldriverPercentChange$;

  callVolumeObjectiveCriteria = callVolumeObjectiveCriteria;
  callVolumeKpiConfig = {
    pass: { message: 'kpi-met-volume' },
    fail: { message: 'kpi-not-met-volume' },
  };


  taskSuccessObjectiveStatus$ = this.projectsDetailsService.taskSuccessObjectiveStatus$;

  objectiveStatusConfig: Record<string, { icon: string; colourClass: string; messageKey: string }> = {
    pass: { icon: 'check_circle', colourClass: 'text-success', messageKey: 'kpi-met' },
    partial: { icon: 'check_circle', colourClass: 'text-semisuccess', messageKey: 'kpi-half-met' },
    fail: { icon: 'warning', colourClass: 'text-danger', messageKey: 'kpi-not-met' },
  };

  tasksTestedTableData$ = this.projectsDetailsService.tasksTestedData$.pipe(
    map((tasks) =>
      tasks.map((task) => {
        const baseline = task.tests.find((t) => t.testType === 'Baseline');
        const validation = task.tests.find((t) => t.testType === 'Validation');
        const exploratory = task.tests.find((t) => t.testType === 'Exploratory');
        const spotCheck = task.tests.find((t) => t.testType === 'Spot Check');
        return {
          _id: task.taskNumber.toString(),
          taskNumber: task.taskNumber,
          taskTitle: task.taskTitle,
          baseline: baseline?.successRate ?? null,
          validation: validation?.successRate ?? null,
          exploratory: exploratory?.successRate ?? null,
          spotCheck: spotCheck?.successRate ?? null,
          change: task.avgTaskSuccessChange != null
            ? task.avgTaskSuccessChange / 100
            : null,
          scenariosByTestType: task.scenariosByTestType,
        };
      })
    ),
  );

  testTypesPresent$ = this.projectsDetailsService.tasksTestedData$.pipe(
    map((tasks) => {
      const present = new Set<string>();
      for (const task of tasks || []) {
        for (const test of task.tests) {
          present.add(test.testType);
        }
      }
      return {
        hasValidation: present.has('Validation'),
        hasExploratory: present.has('Exploratory'),
        hasSpotCheck: present.has('Spot Check'),
      };
    }),
  );

  tasksTestedCols: ColumnConfig[] = [];

  description$ = this.projectsDetailsService.description$;

  startDate$ = this.projectsDetailsService.startDate$;
  launchDate$ = this.projectsDetailsService.launchDate$;

  participantTasksCols: ColumnConfig<ParticipantTasksColTypes>[] = [];
    
  dyfTableCols: ColumnConfig<{
    name: string;
    currValue: number;
    prevValue: string;
  }>[] = [];

  dateRangeLabel$ = this.projectsDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ =
    this.projectsDetailsService.comparisonDateRangeLabel$;

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    combineLatest([
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
      this.currentLang$,
      this.testTypesPresent$,
    ]).subscribe(([dateRange, comparisonDateRange, lang, testTypesPresent]) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';

      this.documentsCols = [
        {
          field: 'filename',
          header: this.i18n.service.translate('File link', lang),
          type: 'link',
          typeParams: { link: 'url', external: true },
        },
      ];

      this.dyfChartLegend = [
        this.i18n.service.translate('yes', lang),
        this.i18n.service.translate('no', lang),
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

      this.participantTasksCols = [
        {
          field: 'title',
          header: 'Task list',
          translate: true,
          type: 'link',
          typeParams: { preLink: '/' + this.langLink + '/tasks', link: '_id' },
        },
        {
          field: 'callsPer100Visits',
          header: 'kpi-calls-per-100-title',
          pipe: 'number',
          pipeParam: '1.0-2',
        },
        {
          field: 'dyfNoPer1000Visits',
          header: 'kpi-feedback-per-1000-title',
          pipe: 'number',
          pipeParam: '1.0-2',
        },
        {
          field: 'uxTestInLastTwoYears',
          header: 'UX Test in Past 2 Years?',
          translate: true,
        },
        {
          field: 'latestSuccessRate',
          header: 'Latest success rate',
          pipe: 'percent',
          tooltip: 'tooltip-latest-success-rate-projectsection',
        },
      ];
    

      const tasksTestedCols: ColumnConfig[] = [
        {
          field: 'taskNumber',
          header: this.i18n.service.translate('task-num', lang),
          width: '80px',
        },
        {
          field: 'taskTitle',
          header: this.i18n.service.translate('task', lang),
        },
        {
          field: 'baseline',
          header: this.i18n.service.translate('Baseline', lang),
          pipe: 'percent',
        },
        {
          field: 'validation',
          header: this.i18n.service.translate('Validation', lang),
          pipe: 'percent',
        },
      ];

      if (testTypesPresent.hasExploratory) {
        tasksTestedCols.push({
          field: 'exploratory',
          header: this.i18n.service.translate('Exploratory', lang),
          pipe: 'percent',
        });
      }

      if (testTypesPresent.hasSpotCheck) {
        tasksTestedCols.push({
          field: 'spotCheck',
          header: this.i18n.service.translate('Spot Check', lang),
          pipe: 'percent',
        });
      }

      if (testTypesPresent.hasValidation) {
        tasksTestedCols.push({
          field: 'change',
          header: this.i18n.service.translate('change', lang),
          pipe: 'percent',
          pipeParam: '1.0-0',
          indicator: true,
          upGoodDownBad: true,
          useArrows: true,
          showTextColours: true,
        });
      }

      this.tasksTestedCols = tasksTestedCols;
    });
  }

  getScenarioTestTypes(rowData: Record<string, unknown>): string[] {
    const scenarios = rowData['scenariosByTestType'] as Record<string, string[]> | undefined;
    const keys = Object.keys(scenarios || {});
    const order: Record<string, number> = {
      Baseline: 0,
      Validation: 1,
      Exploratory: 2,
      'Spot Check': 3,
    };
    return keys.sort(
      (a, b) => (order[a] ?? 99) - (order[b] ?? 99),
    );
  }
}
