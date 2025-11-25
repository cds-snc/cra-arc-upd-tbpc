import { Component, inject, OnInit } from '@angular/core';
import { map } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import type { UnwrapObservable } from '@dua-upd/utils-common';
import { TasksHomeFacade } from './+state/tasks-home.facade';

@Component({
    selector: 'upd-tasks-home',
    templateUrl: './tasks-home.component.html',
    styleUrls: ['./tasks-home.component.css'],
    standalone: false
})
export class TasksHomeComponent implements OnInit {
  private readonly tasksHomeService = inject(TasksHomeFacade);

  loading$ = this.tasksHomeService.loaded$.pipe(map((loaded) => !loaded));

  totalTasks$ = this.tasksHomeService.totalTasks$;
  tasksHomeData$ = this.tasksHomeService.tasksHomeTableData$;
  totalVisits$ = this.tasksHomeService.totalVisits$;
  totalVisitsChange$ = this.tasksHomeService.totalVisitsChange$;
  totalCalls$ = this.tasksHomeService.totalCalls$;
  totalCallsChange$ = this.tasksHomeService.totalCallsChange$;

  tasksHomeColumns = [
    {
      field: 'tmf_rank',
      header: 'Rank',
      frozen: true,
      width: '80px',
      center: true,
    },
    {
      field: 'task',
      header: 'task',
      type: 'link',
      typeParam: '_id',
      translate: true,
      frozen: true,
    },
    {
      field: 'portfolio',
      header: 'Portfolio',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'group',
      header: 'group',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'tasks_subgroup',
      header: 'tasks_subgroup',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'service',
      header: 'service',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'user_journey',
      header: 'user_journey',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'status',
      header: 'status',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'channel',
      header: 'channel',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'core',
      header: 'core',
      hide: true,
      translate: true,
      group: 'categories',
    },
    // {
    //   field: 'ux_testing',
    //   header: 'UX testing',
    // },
    // {
    //   field: 'cops',
    //   header: 'COPS',
    //   type: 'label',
    //   typeParam: '??' // copy from projects
    // },
    // {
    //   field: 'pages_mapped',
    //   header: 'Pages mapped',
    //   pipe: 'number',
    // },
    // {
    //   field: 'projects_mapped',
    //   header: 'Projects mapped',
    //   pipe: 'number',
    // },
    {
      field: 'program',
      header: 'Program',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'user_type',
      header: 'Audience',
      translate: true,
      frozen: true,
    },
    {
      field: 'topic',
      header: 'topic',
      hide: true,
      translate: true,
      group: 'categories',
    },
    {
      field: 'tasks_subtopic',
      header: 'tasks_subtopic',
      translate: true,
      hide: true,
      group: 'categories',
    },
    {
      field: 'visits',
      header: 'visits',
      pipe: 'number',
      width: '100px',
      group: 'tab-webtraffic',
    },
    {
      field: 'visits_percent_change',
      header: 'kpi-visits-change',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: true,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'visits_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      hide: true,
      width: '120px',
      group: 'tab-webtraffic',
    },
    {
      field: 'calls',
      header: 'Call volume',
      pipe: 'number',
      width: '100px',
      group: 'tab-calldrivers',
    },
    {
      field: 'calls_percent_change',
      header: 'Change in call volume',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: false,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'calls_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      hide: true,
      width: '120px',
      group: 'tab-calldrivers',
    },
        {
      field: 'calls_per_100_visits',
      header: 'kpi-calls-per-100-title',
      pipe: 'number',
      pipeParam: '1.2-2',
      width: '120px',
      group: 'tab-calldrivers',
    },
    {
      field: 'calls_per_100_visits_percent_change',
      header: 'kpi-calls-per-100-title-change',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: false,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'calls_per_100_visits_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      width: '160px',
      hide: true,
      group: 'tab-calldrivers',
    },
    {
      field: 'dyf_no',
      header: 'negative-feedback-noclicks',
      pipe: 'number',
      width: '120px',
      group: 'tab-pagefeedback',
    },
    {
      field: 'dyf_no_percent_change',
      header: 'negative-feedback-noclicks-change',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: false,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'dyf_no_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      hide: true,
      width: '120px',
      group: 'tab-pagefeedback',
    },
    {
      field: 'dyf_no_per_1000_visits',
      header: 'kpi-feedback-per-1000-title',
      pipe: 'number',
      pipeParam: '1.2-2',
      width: '120px',
      group: 'tab-pagefeedback',
    },
    {
      field: 'dyf_no_per_1000_visits_percent_change',
      header: 'kpi-feedback-per-1000-title-change',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: false,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'dyf_no_per_1000_visits_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      width: '160px',
      hide: true,
      group: 'tab-pagefeedback',
    },
    {
      field: 'survey',
      header: 'survey',
      pipe: 'number',
      tooltip: 'tooltip-survey-volume',
      width: '120px',
      hide: true,
      group: 'tab-gctasks',
    },
    {
      field: 'survey_percent_change',
      header: 'survey-volume-change',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: true,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'survey_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      width: '120px',
      hide: true,
      group: 'tab-gctasks',
    },
    {
      field: 'survey_completed',
      header: 'Self-reported task success',
      pipe: 'percent',
      tooltip: 'tooltip-self-reported-success',
      group: 'tab-gctasks',
    },
    {
      field: 'survey_completed_percent_change',
      header: 'Self-reported task success change',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: true,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'survey_completed_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      width: '120px',
      hide: true,
      group: 'tab-gctasks',
    },
    {
      field: 'latest_ux_success',
      header: 'Task success',
      pipe: 'percent',
      tooltip: 'tooltip-latest-success-rate',
      width: '110px',
      group: 'tab-uxtests',
    },
    {
      field: 'latest_success_rate_percent_change',
      header: 'Task success change',
      pipe: 'percent',
      pipeParam: '1.0-2',
      upGoodDownBad: true,
      indicator: true,
      useArrows: true,
      showTextColours: true,
      secondaryField: {
        field: 'latest_success_rate_difference',
        pipe: 'number',
        pipeParam: '1.0-2',
      },
      hide: true,
      width: '150px',
      group: 'tab-uxtests',
    },
  ] as ColumnConfig<UnwrapObservable<typeof this.tasksHomeData$>>[];

  ngOnInit() {
    this.tasksHomeService.init();
  }
}
