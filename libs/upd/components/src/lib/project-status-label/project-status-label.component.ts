import { Component, Input } from '@angular/core';
import { ProjectStatus, PageStatus, ProjectType } from '@dua-upd/types-common';

@Component({
  selector: 'upd-project-status-label',
  template: `
    <span
      *ngIf="projectStatus"
      class="badge {{ styleClass }}  {{ projectStatusClassMap[projectStatus] }}"
      >{{ projectStatus | translate }}</span
    >
    <span
      *ngIf="pageStatus"
      class="badge w-100 {{ styleClass }}  {{ pageStatusClassMap[pageStatus] }}"
      >{{ pageStatus | translate }}</span
    >
    <span
      *ngIf="projectType"
      class="badge {{ styleClass }} {{ projectTypeClassMap[projectType] }}"
      >{{ projectType | translate }}</span
    >
  `,
  styleUrls: ['./project-status-label.component.scss'],
})
export class ProjectStatusLabelComponent {
  @Input() projectStatus: ProjectStatus | null = null;
  @Input() pageStatus: PageStatus | null = null;
  @Input() projectType: ProjectType | null = null;
  @Input() styleClass: string | null = null;

  projectStatusClassMap: Record<ProjectStatus, string> = {
    Unknown: 'bg-unknown',
    Planning: 'bg-planning',
    'In Progress': 'bg-in-progress',
    Complete: 'bg-complete',
    Delayed: 'bg-delayed',
    Exploratory: 'bg-exploratory',
    Monitoring: 'bg-monitoring',
    'Needs review': 'bg-needs-review',
    Paused: 'bg-paused',
  };

  pageStatusClassMap: Record<PageStatus, string> = {
    Live: 'bg-complete',
    '404': 'bg-404',
    Redirected: 'bg-redirect',
  };

  projectTypeClassMap: Record<ProjectType, string> = {
    COPS: 'bg-primary',
  };
}
