import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { globalColours } from '@dua-upd/utils-common';

export interface TaskTestedData {
  taskNumber: number;
  taskTitle: string;
  taskId: string;
  scenarioId: string;
  scenariosByTestType: Record<string, string[]>;
  tests: {
    testType: string;
    testTypeLabel: string;
    successRate: number | null;
    successRatePercent: number | null;
    totalUsers: number;
  }[];
  avgTaskSuccessChange: number | null;
  avgTaskSuccessPercentChange: number | null;
}

export interface TasksTestedSummary {
  tasksCount: number;
  scenariosCount: number;
  participantsPerTest: number | null;
}

@Component({
  selector: 'upd-tasks-tested',
  templateUrl: './tasks-tested.component.html',
  styleUrls: ['./tasks-tested.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksTestedComponent {
  @Input() set tasksTestedData(value: TaskTestedData[] | null | undefined) {
    this._tasksTestedData.set(value ?? null);
  }
  @Input() set tasksTestedSummary(value: TasksTestedSummary | null | undefined) {
    this._tasksTestedSummary.set(value ?? null);
  }
  @Input() set totalParticipants(value: number | null | undefined) {
    this._totalParticipants.set(value ?? null);
  }
  @Input() langLink = 'en';

  private _tasksTestedData = signal<TaskTestedData[] | null>(null);
  private _tasksTestedSummary = signal<TasksTestedSummary | null>(null);
  private _totalParticipants = signal<number | null>(null);

  tasksTestedDataValue = computed(() => this._tasksTestedData());
  tasksTestedSummaryValue = computed(() => this._tasksTestedSummary());
  totalParticipantsValue = computed(() => this._totalParticipants());

  hasData = computed(() => {
    const data = this._tasksTestedData();
    return data && data.length > 0;
  });

  hasBaseline = computed(() =>
    (this._tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Baseline'),
    ),
  );

  hasValidation = computed(() =>
    (this._tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Validation'),
    ),
  );

  hasExploratory = computed(() =>
    (this._tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Exploratory'),
    ),
  );

  hasSpotCheck = computed(() =>
    (this._tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Spot Check'),
    ),
  );

  readonly testTypeBarColors: Record<string, string> = {
    Baseline: globalColours[0],
    Validation: globalColours[1],
    Exploratory: globalColours[2],
    'Spot Check': globalColours[3],
  };

  getBarColor(testType: string): string {
    return this.testTypeBarColors[testType] || globalColours[2];
  }

  getChangeIndicator(value: number | null): { text: string; cssClass: string } {
    if (value == null) {
      return { text: '-', cssClass: 'text-muted' };
    }
    if (value > 0) {
      return { text: `↑${Math.abs(Math.round(value))}%`, cssClass: 'text-success' };
    }
    if (value < 0) {
      return { text: `↓${Math.abs(Math.round(value))}%`, cssClass: 'text-danger' };
    }
    return { text: '0%', cssClass: 'text-muted' };
  }
}
