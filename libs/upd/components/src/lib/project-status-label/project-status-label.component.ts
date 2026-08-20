import { Component, computed, input } from '@angular/core';
import type { LabelValue } from '@dua-upd/types-common';

interface LabelDefinition {
  className: string;
  fullWidth?: boolean;
}

const LABEL_DEFINITIONS = {
  Unknown: { className: 'bg-unknown' },
  Planning: { className: 'bg-planning' },
  'In Progress': { className: 'bg-in-progress' },
  Complete: { className: 'bg-complete' },
  Delayed: { className: 'bg-delayed' },
  Exploratory: { className: 'bg-exploratory' },
  Monitoring: { className: 'bg-monitoring' },
  'Needs review': { className: 'bg-needs-review' },
  Paused: { className: 'bg-paused' },
  COPS: { className: 'bg-primary' },
  WOS_COPS: { className: 'bg-info' },
  Live: { className: 'bg-complete', fullWidth: true },
  '404': { className: 'bg-404', fullWidth: true },
  Redirected: { className: 'bg-redirect', fullWidth: true },
  Stable: { className: 'bg-healthy' },
  Watch: { className: 'bg-watch' },
  'Action required': { className: 'bg-needs-action' },
  Unscored: { className: 'bg-unscored' },
  Archived: { className: 'bg-archive' },
  'Not archived': { className: 'bg-primary' },
  Pass: { className: 'bg-completed' },
  Fail: { className: 'bg-delayed' },
} satisfies Record<LabelValue, LabelDefinition>;

@Component({
  selector: 'upd-project-status-label',
  template: `
    <span
      class="badge d-block {{ definition().className }}"
      [class.w-100]="definition().fullWidth"
      >{{ labelValue() | translate }}</span
    >
  `,
  styleUrls: ['./project-status-label.component.scss'],
  standalone: false,
})
export class ProjectStatusLabelComponent {
  labelValue = input.required<LabelValue>();

  definition = computed<LabelDefinition>(
    () => LABEL_DEFINITIONS[this.labelValue()],
  );
}
