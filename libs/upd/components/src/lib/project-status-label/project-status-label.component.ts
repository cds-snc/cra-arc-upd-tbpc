import { Component, Input } from '@angular/core';
import {
  ProjectStatus,
  PageStatus,
  ProjectType,
  TaskStatus,
  ArchivedStatus,
  PageArchivedStatus,
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
    @if (archivedStatus) {
      <span
        class="badge {{ styleClass }} {{
          archivedStatusClassMap[archivedStatus]
        }} d-block"
        >{{ archivedStatus | translate }}</span
      >
    }
    @if (pageArchivedStatus) {
      <span
        class="badge {{ styleClass }} {{
          pageArchivedStatusClassMap[pageArchivedStatus]
        }} d-block"
        >{{ pageArchivedStatus | translate }}</span
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
  @Input() archivedStatus: ArchivedStatus | null = null;
  @Input() pageArchivedStatus: PageArchivedStatus | null = null;
  @Input() styleClass: string | null = null;

  projectStatusClassMap = statusLabelClassMap['projectStatus'];

  pageStatusClassMap = statusLabelClassMap['pageStatus'];

  projectTypeClassMap = statusLabelClassMap['projectType'];

  taskStatusClassMap = statusLabelClassMap['taskStatus'];

  archivedStatusClassMap = statusLabelClassMap['archivedStatus'];

  pageArchivedStatusClassMap = statusLabelClassMap['pageArchivedStatus'];
}

const projectStatusClassMap: Record<ProjectStatus, string> = {
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

const pageStatusClassMap: Record<PageStatus, string> = {
  Live: 'bg-complete',
  '404': 'bg-404',
  Redirected: 'bg-redirect',
};

const projectTypeClassMap: Record<ProjectType, string> = {
  COPS: 'bg-primary',
  WOS_COPS: 'bg-info',
};

const taskStatusClassMap: Record<TaskStatus, string> = {
  'On track': 'bg-healthy',
  Watch: 'bg-watch',
  'Action required': 'bg-needs-action',
  Unscored: 'bg-unscored',
  Pending: 'bg-pending',
};

const archivedStatusClassMap: Record<ArchivedStatus, string> = {
  Archived: 'bg-archived',
  'Not archived': 'bg-primary',
};

const pageArchivedStatusClassMap: Record<PageArchivedStatus, string> = {
  Live: 'bg-complete',
  '404': 'bg-404',
  Redirected: 'bg-redirect',
  Archived: 'bg-archived',
  'Not archived': 'bg-primary',
};

export const statusLabelClassMap = {
  projectStatus: projectStatusClassMap,
  pageStatus: pageStatusClassMap,
  projectType: projectTypeClassMap,
  taskStatus: taskStatusClassMap,
  archivedStatus: archivedStatusClassMap,
  pageArchivedStatus: pageArchivedStatusClassMap,
} as const;
