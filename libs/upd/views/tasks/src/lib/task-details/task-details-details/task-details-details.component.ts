import { Component, inject } from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { TasksDetailsFacade } from '../+state/tasks-details.facade';

@Component({
    selector: 'upd-task-details-details',
    templateUrl: './task-details-details.component.html',
    styleUrls: ['./task-details-details.component.css'],
    standalone: false
})
export class TaskDetailsDetailsComponent {
  private i18n = inject(I18nFacade);
  private readonly taskDetailsService = inject(TasksDetailsFacade);

  currentLang$ = this.i18n.currentLang$;

  detailsTable$ = this.taskDetailsService.detailsTable$;
}
