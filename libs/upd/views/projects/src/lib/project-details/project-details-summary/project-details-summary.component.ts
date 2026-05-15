import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { combineLatest, map, shareReplay } from 'rxjs';
import { EN_CA } from '@dua-upd/upd/i18n';
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

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

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

  tasksTestedCols: ColumnConfig[] = [];

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    combineLatest([this.currentLang$, this.testTypesPresent$]).subscribe(
      ([lang, testTypesPresent]) => {
        this.langLink = lang === EN_CA ? 'en' : 'fr';

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

        if (testTypesPresent.hasBaseline) {
          tasksTestedCols.push({
            field: 'baseline',
            header: this.i18n.service.translate('Baseline', lang),
            pipe: 'percent',
          });
        }

        if (testTypesPresent.hasValidation) {
          tasksTestedCols.push({
            field: 'validation',
            header: this.i18n.service.translate('Validation', lang),
            pipe: 'percent',
          });
        }

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

        if (testTypesPresent.hasBaseline && testTypesPresent.hasValidation) {
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
      },
    );
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
