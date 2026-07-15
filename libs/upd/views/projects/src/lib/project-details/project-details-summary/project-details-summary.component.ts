import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, shareReplay } from 'rxjs';
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

  currentLang = this.i18n.currentLang;
  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));

  description$ = this.projectsDetailsService.description$;

  apexCallDrivers$ = this.projectsDetailsService.apexCallDrivers$;
  callPerVisits$ = this.projectsDetailsService.callPerVisits$;
  apexCallPercentChange$ = this.projectsDetailsService.apexCallPercentChange$;
  apexCallDifference$ = this.projectsDetailsService.apexCallDifference$;

  apexKpiFeedback$ = this.projectsDetailsService.apexKpiFeedback$;
  currentKpiFeedback$ = this.projectsDetailsService.currentKpiFeedback$;
  kpiFeedbackPercentChange$ =
    this.projectsDetailsService.kpiFeedbackPercentChange$;
  kpiFeedbackDifference$ = this.projectsDetailsService.kpiFeedbackDifference$;
  feedbackKpiObjectiveCriteria = feedbackKpiObjectiveCriteria;

  visits$ = this.projectsDetailsService.visits$;
  visitsPercentChange$ = this.projectsDetailsService.visitsPercentChange$;

  totalCalldriver$ = this.projectsDetailsService.totalCalldriver$;
  totalCalldriverPercentChange$ =
    this.projectsDetailsService.totalCalldriverPercentChange$;
  callVolumeObjectiveCriteria = callVolumeObjectiveCriteria;
  callVolumeKpiConfig = {
    pass: { message: 'kpi-met-volume' },
    fail: { message: 'kpi-not-met-volume' },
  };

  participantTasks$ = this.projectsDetailsService.projectTasks$;

  participantTasksCols = computed<ColumnConfig<ParticipantTasksColTypes>[]>(
    () => [
      {
        field: 'title',
        header: 'Task list',
        translate: true,
        type: 'link',
        typeParams: { preLink: '/' + this.langLink() + '/tasks', link: '_id' },
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
    ],
  );

  baselineTestData$ = this.projectsDetailsService.baselineTestData$;
  validationTestData$ = this.projectsDetailsService.validationTestData$;
  taskSuccessChange$ = this.projectsDetailsService.taskSuccessChange$;

  taskSuccessObjectiveStatus$ = this.projectsDetailsService.taskSuccessObjectiveStatus$;

  private tasksTestedView$ = this.projectsDetailsService.tasksTestedData$.pipe(
    map((tasks) => {
      const tableData = tasks.map((task) => {
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
      });

      const present = new Set<string>();
      for (const task of tasks || []) {
        for (const test of task.tests) {
          present.add(test.testType);
        }
      }

      return {
        tableData,
        present: {
          hasBaseline: present.has('Baseline'),
          hasValidation: present.has('Validation'),
          hasExploratory: present.has('Exploratory'),
          hasSpotCheck: present.has('Spot Check'),
        },
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  tasksTestedTableData$ = this.tasksTestedView$.pipe(map((v) => v.tableData));
  testTypesPresent$ = this.tasksTestedView$.pipe(map((v) => v.present));

  private testTypesPresent = toSignal(this.testTypesPresent$);

  tasksTestedCols = computed<ColumnConfig[]>(() => {
    const lang = this.currentLang();
    const present = this.testTypesPresent();

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
    ];

    if (present?.hasBaseline) {
      tasksTestedCols.push({
        field: 'baseline',
        header: this.i18n.service.translate('Baseline', lang),
        pipe: 'percent',
      });
    }

    if (present?.hasValidation) {
      tasksTestedCols.push({
        field: 'validation',
        header: this.i18n.service.translate('Validation', lang),
        pipe: 'percent',
      });
    }

    if (present?.hasExploratory) {
      tasksTestedCols.push({
        field: 'exploratory',
        header: this.i18n.service.translate('Exploratory', lang),
        pipe: 'percent',
      });
    }

    if (present?.hasSpotCheck) {
      tasksTestedCols.push({
        field: 'spotCheck',
        header: this.i18n.service.translate('Spot Check', lang),
        pipe: 'percent',
      });
    }

    if (present?.hasBaseline && present?.hasValidation) {
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

    return tasksTestedCols;
  });

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private readonly scenarioTypeOrder: Record<string, number> = {
    Baseline: 0,
    Validation: 1,
    Exploratory: 2,
    'Spot Check': 3,
  };

  getScenarioDescriptions(
    rowData: Record<string, unknown>,
  ): { heading: string; text: string; html: string | null }[] {
    const scenarios = rowData['scenariosByTestType'] as
      | Record<string, { text: string; html?: string | null }[]>
      | undefined;
    if (!scenarios) return [];

    const descByKey = new Map<
      string,
      { types: string[]; text: string; html: string | null; order: number }
    >();
    for (const [type, entries] of Object.entries(scenarios)) {
      const order = this.scenarioTypeOrder[type] ?? 99;
      for (const entry of entries) {
        const key = entry.text
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        const existing = descByKey.get(key);
        if (existing) {
          if (!existing.types.includes(type)) {
            existing.types.push(type);
          }
          if (order < existing.order) {
            existing.text = entry.text;
            existing.html = entry.html ?? null;
            existing.order = order;
          }
        } else {
          descByKey.set(key, {
            types: [type],
            text: entry.text,
            html: entry.html ?? null,
            order,
          });
        }
      }
    }

    return [...descByKey.values()]
      .sort((a, b) => a.order - b.order)
      .map((desc) => ({
        heading: this.scenarioHeading(desc.types),
        text: desc.text,
        html: desc.html,
      }));
  }

  private scenarioHeading(types: string[]): string {
    const lang = this.currentLang();
    const ordered = [...types].sort(
      (a, b) =>
        (this.scenarioTypeOrder[a] ?? 99) - (this.scenarioTypeOrder[b] ?? 99),
    );
    if (ordered.length === 1) {
      return this.i18n.service.translate(
        this.scenarioHeadingKeys[ordered[0]] ?? 'scenario',
        lang,
      );
    }
    const mergedKey = this.mergedScenarioHeadingKeys[ordered.join('+')];
    if (mergedKey) {
      return this.i18n.service.translate(mergedKey, lang);
    }
    const typeNames = ordered
      .map((type) => this.i18n.service.translate(type, lang))
      .join(' / ');
    const scenarioWord = this.i18n.service
      .translate('scenario', lang)
      .toLowerCase();
    return `${typeNames} ${scenarioWord}`;
  }

  private readonly scenarioHeadingKeys: Record<string, string> = {
    Baseline: 'baseline-scenario',
    Validation: 'validation-scenario',
    Exploratory: 'exploratory-scenario',
    'Spot Check': 'spot-check-scenario',
  };

  private readonly mergedScenarioHeadingKeys: Record<string, string> = {
    'Baseline+Validation': 'baseline-validation-scenario',
  };
}
