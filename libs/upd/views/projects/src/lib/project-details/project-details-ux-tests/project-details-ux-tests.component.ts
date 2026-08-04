import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';
import { EN_CA } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import type { GetTableProps } from '@dua-upd/utils-common';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, shareReplay } from 'rxjs';

type DocumentsColTypes = GetTableProps<
  ProjectDetailsUxTestsComponent,
  'documents$'
>;

@Component({
  selector: 'upd-project-details-ux-tests',
  templateUrl: './project-details-ux-tests.component.html',
  styleUrls: ['./project-details-ux-tests.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ProjectDetailsUxTestsComponent {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang = this.i18n.currentLang;
  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));

  baselineTestData$ = this.projectsDetailsService.baselineTestData$;
  validationTestData$ = this.projectsDetailsService.validationTestData$;
  exploratoryTestData$ = this.projectsDetailsService.exploratoryTestData$;
  spotCheckTestData$ = this.projectsDetailsService.spotCheckTestData$;
  taskSuccessChange$ = this.projectsDetailsService.taskSuccessChange$;
  avgSuccessValueChange$ = this.projectsDetailsService.avgSuccessValueChange$;

  taskSuccessObjectiveStatus$ =
    this.projectsDetailsService.taskSuccessObjectiveStatus$;

  documents$ = this.projectsDetailsService.documents$;

  totalParticipants$ = this.projectsDetailsService.totalParticipants$;

  scenariosTestedData$ = this.projectsDetailsService.scenariosTestedData$;
  tasksTestedSummary$ = this.projectsDetailsService.tasksTestedSummary$;

  private tasksTestedView$ = this.projectsDetailsService.tasksTestedData$.pipe(
    map((tasks) => {
      const tableData = tasks.map((task) => {
        const baseline = task.tests.find((t) => t.testType === 'Baseline');
        const validation = task.tests.find((t) => t.testType === 'Validation');
        const exploratory = task.tests.find(
          (t) => t.testType === 'Exploratory',
        );
        const spotCheck = task.tests.find((t) => t.testType === 'Spot Check');
        return {
          _id: task.taskNumber.toString(),
          taskNumber: task.taskNumber,
          taskTitle: task.taskTitle,
          baseline: baseline?.successRate ?? null,
          validation: validation?.successRate ?? null,
          exploratory: exploratory?.successRate ?? null,
          spotCheck: spotCheck?.successRate ?? null,
          avgTaskSuccessPointChange:
            task.avgTaskSuccessPointChange != null
              ? task.avgTaskSuccessPointChange
              : null,
          avgTaskSuccessPercentChange:
            task.avgTaskSuccessPercentChange != null
              ? task.avgTaskSuccessPercentChange / 100
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

  testTypesPresent$ = this.tasksTestedView$.pipe(map((v) => v.present));
  private testTypesPresent = toSignal(this.testTypesPresent$);


  private testTypesFromProjectData$ = combineLatest([
    this.baselineTestData$,
    this.validationTestData$,
    this.exploratoryTestData$,
    this.spotCheckTestData$,
  ]).pipe(
    map(([baseline, validation, exploratory, spotCheck]) => ({
      hasBaseline: !!baseline,
      hasValidation: !!validation,
      hasExploratory: !!exploratory,
      hasSpotCheck: !!spotCheck,
    })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private testTypesFromProjectData = toSignal(this.testTypesFromProjectData$);

  hasBaseline() {
    return (
      this.testTypesFromProjectData()?.hasBaseline ||
      this.testTypesPresent()?.hasBaseline
    );
  }

  hasValidation() {
    return (
      this.testTypesFromProjectData()?.hasValidation ||
      this.testTypesPresent()?.hasValidation
    );
  }

  hasExploratory() {
    return (
      this.testTypesFromProjectData()?.hasExploratory ||
      this.testTypesPresent()?.hasExploratory
    );
  }

  hasSpotCheck() {
    return (
      this.testTypesFromProjectData()?.hasSpotCheck ||
      this.testTypesPresent()?.hasSpotCheck
    );
  }

  hasAnyTests() {
    const present = this.testTypesFromProjectData();
    return (
      present?.hasBaseline ||
      present?.hasValidation ||
      present?.hasExploratory ||
      present?.hasSpotCheck
    );
  }

  documentsCols = computed<ColumnConfig<DocumentsColTypes>[]>(() => [
    {
      field: 'filename',
      header: this.i18n.service.translate('File link', this.currentLang()),
      type: 'link',
      typeParams: { link: 'url', external: true },
    },
  ]);
}
