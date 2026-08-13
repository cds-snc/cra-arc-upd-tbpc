import { Component, computed, input } from '@angular/core';
import {
  ProjectStatus,
  PageStatus,
  ProjectType,
  TaskStatus,
  ArchivedStatus,
  PassFailStatus,
  LabelClassMapKey,
  LabelType,
} from '@dua-upd/types-common';
import type { UnwrapSignal } from '@dua-upd/upd/utils';

export type LabelClassMap<T extends LabelType> = {
  [K in LabelClassMapKey<T>]: string;
};

@Component({
  selector: 'upd-project-status-label',
  template: `
    <span
      [class.w-100]="labelType() === 'pageStatus'"
      class="badge {{ styleClass() }} {{
        labelClass() || 'bg-unknown'
      }} d-block"
      >{{ labelValue() | translate }}</span
    >
  `,
  styleUrls: ['./project-status-label.component.scss'],
  standalone: false,
})
export class ProjectStatusLabelComponent<const T extends LabelType> {
  labelType = input.required<T>();
  labelValue = input.required<LabelClassMapKey<T>>();

  styleClass = input<string | null>(null);

  classMap = computed<LabelClassMap<T>>(() => {
    switch (this.labelType()) {
      case 'projectStatus':
        return this.projectStatusClassMap as LabelClassMap<T>;
      case 'pageStatus':
        return this.pageStatusClassMap as LabelClassMap<T>;
      case 'projectType':
        return this.projectTypeClassMap as LabelClassMap<T>;
      case 'taskStatus':
        return this.taskStatusClassMap as LabelClassMap<T>;
      case 'archivedStatus':
        return this.archiveStatusClassMap as LabelClassMap<T>;
      case 'passFail':
        return this.passFailClassMap as LabelClassMap<T>;
      default:
        throw new Error(`Invalid labelType: ${this.labelType()}`);
    }
  });

  labelClass = computed(() => this.classMap()[this.labelValue()]);

  projectStatusClassMap: LabelClassMap<'projectStatus'> = {
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

  pageStatusClassMap: LabelClassMap<'pageStatus'> = {
    Live: 'bg-complete',
    '404': 'bg-404',
    Redirected: 'bg-redirect',
  };

  projectTypeClassMap: LabelClassMap<'projectType'> = {
    COPS: 'bg-primary',
    WOS_COPS: 'bg-info',
  };

  taskStatusClassMap: LabelClassMap<'taskStatus'> = {
    Stable: 'bg-healthy',
    Watch: 'bg-watch',
    'Action required': 'bg-needs-action',
    Unscored: 'bg-unscored',
  };

  archiveStatusClassMap: LabelClassMap<'archivedStatus'> = {
    Archived: 'bg-archive',
    'Not archived': 'bg-primary',
  };

  passFailClassMap: LabelClassMap<'passFail'> = {
    Pass: 'bg-completed',
    Fail: 'bg-delayed',
  };
}

class LabelConfig<T extends LabelType> {
  constructor(
    public config: {
      labelType: T;
      labelValue: LabelClassMapKey<T>;
      styleClass?: string | null;
    },
  ) {}
}

export type { LabelConfig };

export function labelConfig<T extends LabelType>(config: {
  labelType: T;
  labelValue: LabelClassMapKey<T>;
  styleClass?: string | null;
}): LabelConfig<T> {
  return new LabelConfig(config);
}
