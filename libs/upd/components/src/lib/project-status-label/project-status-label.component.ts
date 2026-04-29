import { Component, Input } from '@angular/core';
import {
  ProjectStatus,
  PageStatus,
  ProjectType,
  TaskStatus,
} from '@dua-upd/types-common';

@Component({
  selector: 'upd-project-status-label',
  template: `
    @if (projectStatus) {
      <span
        class="badge {{ styleClass }}  {{
          projectStatusClassMap[projectStatus]
        }} d-block"
        >{{ projectStatus | translate }}</span
      >
    }
    @if (pageStatus) {
      <span
        class="badge w-100 {{ styleClass }}  {{
          pageStatusClassMap[pageStatus]
        }} d-block"
        >{{ pageStatus | translate }}</span
      >
    }
    @if (projectType) {
      <span
        class="badge {{ styleClass }} {{
          projectTypeClassMap[projectType]
        }} d-block"
        >{{ projectType | translate }}</span
      >
    }
    @if (taskStatus) {
      <span
        class="badge {{ styleClass }} {{
          taskStatusClassMap[taskStatus]
        }} d-block"
        >{{ taskStatus | translate }}</span
      >
    }
  `,
  styleUrls: ['./project-status-label.component.scss'],
  standalone: false,
})
export class ProjectStatusLabelComponent {
  @Input() projectStatus: ProjectStatus | null = null;
  @Input() pageStatus: PageStatus | null = null;
  @Input() projectType: ProjectType | null = null;
  @Input() taskStatus: TaskStatus | null = null;
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
    WOS_COPS: 'bg-info',
  };

  taskStatusClassMap: Record<TaskStatus, string> = {
    Healthy: 'bg-healthy',
    Watch: 'bg-watch',
    Improving: 'bg-improving',
    'Needs action': 'bg-needs-action',
  };
}
