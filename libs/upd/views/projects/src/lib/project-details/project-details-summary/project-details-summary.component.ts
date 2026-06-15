import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, shareReplay } from 'rxjs';
import { I18nFacade } from '@dua-upd/upd/state';
import type { ColumnConfig } from '@dua-upd/types-common';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';

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

  description$ = this.projectsDetailsService.description$;

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

  getScenarioTestTypes(rowData: Record<string, unknown>): string[] {
    const scenarios = rowData['scenariosByTestType'] as
      | Record<string, { text: string; html?: string | null }[]>
      | undefined;
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

  private readonly scenarioHeadingKeys: Record<string, string> = {
    Baseline: 'baseline-scenario',
    Validation: 'validation-scenario',
    Exploratory: 'exploratory-scenario',
    'Spot Check': 'spot-check-scenario',
  };

  scenarioHeadingKey(testType: string): string {
    return this.scenarioHeadingKeys[testType] ?? 'scenario';
  }
}
