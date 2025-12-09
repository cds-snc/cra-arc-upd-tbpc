import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { combineLatest } from 'rxjs';
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

  feedbackKpiObjectiveCriteria = feedbackKpiObjectiveCriteria;

  apexCallDrivers$ = this.projectsDetailsService.apexCallDrivers$;
  apexKpiFeedback$ = this.projectsDetailsService.apexKpiFeedback$;

  documents$ = this.projectsDetailsService.documents$;
  documentsCols: ColumnConfig<DocumentsColTypes>[] = [];

  callPerVisits$ = this.projectsDetailsService.callPerVisits$;
  apexCallPercentChange$ = this.projectsDetailsService.apexCallPercentChange$;
  apexCallDifference$ = this.projectsDetailsService.apexCallDifference$;

  currentKpiFeedback$ = this.projectsDetailsService.currentKpiFeedback$;
  kpiFeedbackPercentChange$ =
    this.projectsDetailsService.kpiFeedbackPercentChange$;
  kpiFeedbackDifference$ = this.projectsDetailsService.kpiFeedbackDifference$;

  avgTaskSuccessFromLastTest$ =
    this.projectsDetailsService.avgTaskSuccessFromLastTest$;
  avgSuccessPercentChange$ =
    this.projectsDetailsService.avgSuccessPercentChange$;
  avgSuccessValueChange$ = this.projectsDetailsService.avgSuccessValueChange$;
  dateFromLastTest$ = this.projectsDetailsService.dateFromLastTest$;
  taskSuccessByUxTest$ = this.projectsDetailsService.taskSuccessByUxTest$;

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
    ]).subscribe(([dateRange, comparisonDateRange, lang]) => {
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
    

      // this.memberListCols = [
      //   {
      //     field: 'name',
      //     header: this.i18n.service.translate('Name', lang),
      //   },
      //   {
      //     field: 'role',
      //     header: this.i18n.service.translate('Role', lang),
      //   },
      // ];
    });
  }
}