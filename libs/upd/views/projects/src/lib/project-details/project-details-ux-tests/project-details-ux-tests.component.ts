import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import {
  difference,
  filter,
  flatten,
  intersection,
  keys,
  map,
  pipe,
  piped,
  uniq,
} from 'rambdax';
import type { ColumnConfig } from '@dua-upd/types-common';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';
import { EN_CA } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import { combineLatest } from 'rxjs';
import type { GetTableProps } from '@dua-upd/utils-common';

type DocumentsColTypes = GetTableProps<
  ProjectDetailsUxTestsComponent,
  'documents$'
>;

@Component({
    selector: 'upd-project-details-ux-tests',
    templateUrl: './project-details-ux-tests.component.html',
    styleUrls: ['./project-details-ux-tests.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ProjectDetailsUxTestsComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

  apexTaskSuccessByUxTest$ =
    this.projectsDetailsService.apexTaskSuccessByUxTest$;

  taskSuccessChartHeight$ =
    this.projectsDetailsService.taskSuccessChartHeight$;

  avgTaskSuccessFromLastTest$ =
    this.projectsDetailsService.avgTaskSuccessFromLastTest$;

  avgSuccessPercentChange$ =
    this.projectsDetailsService.avgSuccessPercentChange$;

    avgSuccessValueChange$ =
    this.projectsDetailsService.avgSuccessValueChange$;

  dateFromLastTest$ = this.projectsDetailsService.dateFromLastTest$;

  projectTasks$ = this.projectsDetailsService.projectTasks$;

  taskSuccessByUxTest$ = this.projectsDetailsService.taskSuccessByUxTest$;

  taskSuccessByUxTestKpi$ = this.projectsDetailsService.taskSuccessByUxTestKpi$;

  totalParticipants$ = this.projectsDetailsService.totalParticipants$;

  documents$ = this.projectsDetailsService.documents$;

  documentsCols: ColumnConfig<DocumentsColTypes>[] = [];

  participantTasksCols: ColumnConfig[] = [];
  taskSuccessRateCols: ColumnConfig[] = [];
  successRateCols: ColumnConfig[] = [];

  ngOnInit() {
    combineLatest([this.currentLang$, this.taskSuccessByUxTestKpi$]).subscribe(
      ([lang, kpiData]) => {
        this.documentsCols = [
          {
            field: 'filename',
            header: this.i18n.service.translate('File link', lang),
            type: 'link',
            typeParams: { link: 'url', external: true },
          },
        ];

        this.langLink = lang === EN_CA ? 'en' : 'fr';
        this.participantTasksCols = [
          {
            field: 'title',
            header: this.i18n.service.translate('Task list', lang),
            type: 'link',
            translate: true,
            typeParams: { preLink: `/${this.langLink}/tasks`, link: '_id' },
          },
        ];
        this.taskSuccessRateCols = [
          {
            field: 'tasks',
            header: this.i18n.service.translate('Task list', lang),
            type: 'link',
            typeParams: { preLink: `/${this.langLink}/tasks`, link: '_id' },
          },
          {
            field: 'test_type',
            header: this.i18n.service.translate('test-type', lang),
          },
          {
            field: 'date',
            header: this.i18n.service.translate('date', lang),
          },
          {
            field: 'success_rate',
            header: this.i18n.service.translate('success-rate', lang),
            pipe: 'percent',
          },
        ];

        const testTypesWithSuccessRate = piped(
          kpiData,
          map(
            pipe(
              filter(
                (val: number | boolean | string, key: string) =>
                  !['isChange', 'task'].includes(key) && !isNaN(val as number),
              ),
              keys,
            ),
          ),
          (keys) => flatten<string>(keys),
          uniq,
        );

        if (!testTypesWithSuccessRate.length) {
          return;
        }

        const startCols = [
          {
            field: 'task',
            header: this.i18n.service.translate('task', lang),
            type: 'link',
            typeParams: {
              preLink: '/' + this.langLink + '/tasks',
              link: '_id',
            },
          } as ColumnConfig,
        ];

        if (testTypesWithSuccessRate.includes('Baseline')) {
          startCols.push({
            field: 'Baseline',
            header: this.i18n.service.translate('Baseline', lang),
            pipe: 'percent',
          });
        }

        const middleCols = piped(
          testTypesWithSuccessRate,
          (testTypes) =>
            difference(testTypes, [
              'Baseline',
              'Validation',
              'change',
              'taskPercentChange',
            ]),
          map((key: string) => ({
            field: key,
            header: this.i18n.service.translate(key, lang),
            pipe: 'percent',
          })),
        );

        const endCols = piped(
          testTypesWithSuccessRate,
          (testTypes) => intersection(testTypes, ['Validation']),
          map(
            (key) =>
              ({
                field: key,
                header: this.i18n.service.translate(key, lang),
                pipe: 'percent',
              }) as ColumnConfig,
          ),
        );

        if (testTypesWithSuccessRate.includes('change')) {
          endCols.push({
            field: 'taskPercentChange',
            header: this.i18n.service.translate('change', lang),
            pipe: 'percent',
            pipeParam: '1.0',
            upGoodDownBad: true,
            indicator: true,
            useArrows: false,
            showTextColours: false,
            secondaryField: {
              field: 'change',
              pipe: 'number',
              pipeParam: '1.0',
            },
          });
        }

        this.successRateCols = flatten([startCols, middleCols, endCols]);
      },
    );
  }
}
