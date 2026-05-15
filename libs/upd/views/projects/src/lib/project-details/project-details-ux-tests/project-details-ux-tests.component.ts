import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
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
export class ProjectDetailsUxTestsComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

  baselineTestData$ = this.projectsDetailsService.baselineTestData$;
  validationTestData$ = this.projectsDetailsService.validationTestData$;
  taskSuccessChange$ = this.projectsDetailsService.taskSuccessChange$;

  taskSuccessObjectiveStatus$ = this.projectsDetailsService.taskSuccessObjectiveStatus$;

  documents$ = this.projectsDetailsService.documents$;

  totalParticipants$ = this.projectsDetailsService.totalParticipants$;

  tasksTestedData$ = this.projectsDetailsService.tasksTestedData$;
  tasksTestedSummary$ = this.projectsDetailsService.tasksTestedSummary$;

  documentsCols: ColumnConfig<DocumentsColTypes>[] = [];

  ngOnInit() {
    this.currentLang$.subscribe((lang) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';
      this.documentsCols = [
        {
          field: 'filename',
          header: this.i18n.service.translate('File link', lang),
          type: 'link',
          typeParams: { link: 'url', external: true },
        },
      ];
    });
  }
}
