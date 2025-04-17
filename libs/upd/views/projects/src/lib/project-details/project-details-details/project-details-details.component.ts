import { Component, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';

@Component({
  selector: 'upd-project-details-details',
  templateUrl: './project-details-details.component.html',
  styleUrls: ['./project-details-details.component.css'],
})
export class ProjectDetailsDetailsComponent {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  // memberList$ = this.projectsDetailsService.taskSuccessByUxTest$;

  // memberListCols$: Observable<ColumnConfig[]> = this.i18n.currentLang$.pipe(
  //   map((lang) => [
  //     {
  //       field: 'role',
  //       header: this.i18n.service.translate('Role', lang),
  //     },
  //     {
  //       field: 'projectLead',
  //       header: this.i18n.service.translate('Name', lang),
  //     },
  //     {
  //       field: 'vendor',
  //       header: this.i18n.service.translate('Product', lang),
  //     },
  //   ]),
  // );
}
