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
export class ProjectDetailsUxTestsComponent {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang = this.i18n.currentLang;
  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));

  baselineTestData$ = this.projectsDetailsService.baselineTestData$;
  validationTestData$ = this.projectsDetailsService.validationTestData$;
  taskSuccessChange$ = this.projectsDetailsService.taskSuccessChange$;

  taskSuccessObjectiveStatus$ = this.projectsDetailsService.taskSuccessObjectiveStatus$;

  documents$ = this.projectsDetailsService.documents$;

  totalParticipants$ = this.projectsDetailsService.totalParticipants$;

  tasksTestedData$ = this.projectsDetailsService.tasksTestedData$;
  tasksTestedSummary$ = this.projectsDetailsService.tasksTestedSummary$;

  documentsCols = computed<ColumnConfig<DocumentsColTypes>[]>(() => [
    {
      field: 'filename',
      header: this.i18n.service.translate('File link', this.currentLang()),
      type: 'link',
      typeParams: { link: 'url', external: true },
    },
  ]);
}
