import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type TaskSuccessObjectiveStatus = 'pass' | 'partial' | 'fail';

const STATUS_CONFIG: Record<
  TaskSuccessObjectiveStatus,
  { iconName: string; colourClass: string; messageKey: string }
> = {
  pass: {
    iconName: 'check_circle',
    colourClass: 'text-success',
    messageKey: 'kpi-met',
  },
  partial: {
    iconName: 'check_circle',
    colourClass: 'text-semisuccess',
    messageKey: 'kpi-half-met',
  },
  fail: {
    iconName: 'warning',
    colourClass: 'text-danger',
    messageKey: 'kpi-not-met',
  },
};

@Component({
  selector: 'upd-task-success-objective-status',
  template: `
    @if (status; as s) {
      <div class="mt-3 d-flex align-items-center justify-content-start">
        <span
          class="material-icons me-1 kpi-status-icon"
          [ngClass]="config[s].colourClass"
        >{{ config[s].iconName }}</span>
        <small>{{ config[s].messageKey | translate }}</small>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TaskSuccessObjectiveStatusComponent {
  @Input() status: TaskSuccessObjectiveStatus | null = null;
  readonly config = STATUS_CONFIG;
}
