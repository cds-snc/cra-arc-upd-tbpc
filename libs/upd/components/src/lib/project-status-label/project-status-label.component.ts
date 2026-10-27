import { Component, Input } from '@angular/core';
import {
  ProjectStatus,
  PageStatus,
  ProjectType,
  TaskStatus,
  ArchivedStatus,
  PageArchivedStatus,
  LanguageStatus,
  PortalPageType,
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
    @if (languageStatus) {
      <span
        class="badge {{ styleClass }} {{
          languageStatusClassMap[languageStatus]
        }} d-block"
        >{{ languageStatus | translate }}</span
      >
    }
    @if (portalPageType) {
      <span
        class="badge {{ styleClass }} {{
          portalPageTypeClassMap[portalPageType]
        }} d-block"
        >{{ portalPageType | translate }}</span
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
  @Input() languageStatus: LanguageStatus | null = null;
  @Input() portalPageType: PortalPageType | null = null;
  @Input() styleClass: string | null = null;

  projectStatusClassMap = statusLabelClassMap['projectStatus'];

  pageStatusClassMap = statusLabelClassMap['pageStatus'];

  projectTypeClassMap = statusLabelClassMap['projectType'];

  taskStatusClassMap = statusLabelClassMap['taskStatus'];

  archivedStatusClassMap = statusLabelClassMap['archivedStatus'];

  pageArchivedStatusClassMap = statusLabelClassMap['pageArchivedStatus'];

  languageStatusClassMap = statusLabelClassMap['languageStatus'];

  portalPageTypeClassMap = statusLabelClassMap['portalPageType'];
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

const languageStatusClassMap: Record<LanguageStatus, string> = {
  en: 'bg-english',
  fr: 'bg-french',
};

const portalPageTypeClassMap: Record<PortalPageType, string> = {
  'ams-cms': 'bg-ams-cms',
  individuals: 'bg-individuals',
  business: 'bg-business',
  'represent-client': 'bg-represent-client',
  trusts: 'bg-trusts',
  'registered-plans': 'bg-registered-plans',
  'non-resident': 'bg-non-resident',
  charities: 'bg-charities',
  applications: 'bg-applications',
};

export const statusLabelClassMap = {
  projectStatus: projectStatusClassMap,
  pageStatus: pageStatusClassMap,
  projectType: projectTypeClassMap,
  taskStatus: taskStatusClassMap,
  archivedStatus: archivedStatusClassMap,
  pageArchivedStatus: pageArchivedStatusClassMap,
  languageStatus: languageStatusClassMap,
  portalPageType: portalPageTypeClassMap,
} as const;
