import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import * as TasksHomeActions from './tasks-home.actions';
import * as TasksHomeSelectors from './tasks-home.selectors';
import { I18nFacade } from '@dua-upd/upd/state';
import { getTaskStatus } from '@dua-upd/utils-common';

@Injectable()
export class TasksHomeFacade {
  private i18n = inject(I18nFacade);
  private readonly store = inject(Store);

  loaded$ = this.store.select(TasksHomeSelectors.getTasksHomeLoaded);
  tasksHomeData$ = this.store.select(TasksHomeSelectors.getTasksHomeData);

  tasksHomeTableData$ = this.tasksHomeData$.pipe(
    map((tasksHomeData) =>
      (tasksHomeData?.dateRangeData || []).map((row) => ({
        ...row,
        task: row.title?.replace(/\s+/g, ' ') || '',
        group: row.group || '',
        tasks_subgroup: row.subgroup || '',
        topic: row.topic || '',
        tasks_subtopic: row.subtopic || '',
        program: row.program || '',
        user_type:
          row.user_type.length > 0
            ? row.user_type.map((userType) => userType || '')
            : '',
        status:
          getTaskStatus(
            row.performance_score,
            row.historical_average,
          ) || '',
        change:
          row.performance_score && row.performance_score !== 0
            ? row.performance_score - (row.historical_average ?? 0)
            : null,
      })),
    ),
  );

  totalTasks$ = this.tasksHomeTableData$.pipe(
    map((tasksData) => tasksData.length),
  );

  totalVisits$ = this.tasksHomeData$.pipe(
    map((tasksData) => tasksData.totalVisits || 0),
  );

  totalCalls$ = this.tasksHomeData$.pipe(
    map((tasksData) => tasksData.totalCalls || 0),
  );

  totalVisitsChange$ = this.tasksHomeData$.pipe(
    map((tasksData) => tasksData.percentChange || 0),
  );

  totalCallsChange$ = this.tasksHomeData$.pipe(
    map((tasksData) => tasksData.percentChangeCalls || 0),
  );

  error$ = this.store.select(TasksHomeSelectors.getTasksHomeError);

  /**
   * Use the initialization action to perform one
   * or more tasks in your Effects.
   */
  init() {
    this.store.dispatch(TasksHomeActions.loadTasksHomeInit());
  }
}
