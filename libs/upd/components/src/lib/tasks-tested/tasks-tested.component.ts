import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { globalColours } from '@dua-upd/utils-common';

export interface TaskTestedData {
  taskNumber: number;
  taskTitle: string;
  taskId: string;
  scenariosByTestType: Record<string, string[]>;
  tests: {
    testType: string;
    testTypeLabel: string;
    successRate: number | null;
    successRatePercent: number | null;
  }[];
  avgTaskSuccessChange: number | null;
}

export interface TasksTestedSummary {
  tasksCount: number;
  scenariosCount: number;
}

@Component({
  selector: 'upd-tasks-tested',
  templateUrl: './tasks-tested.component.html',
  styleUrls: ['./tasks-tested.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksTestedComponent {
  tasksTestedData = input<TaskTestedData[] | null>(null);
  tasksTestedSummary = input<TasksTestedSummary | null>(null);
  totalParticipants = input<number | null>(null);
  langLink = input('en');

  hasData = computed(() => {
    const data = this.tasksTestedData();
    return data && data.length > 0;
  });

  hasBaseline = computed(() =>
    (this.tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Baseline'),
    ),
  );

  hasValidation = computed(() =>
    (this.tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Validation'),
    ),
  );

  hasExploratory = computed(() =>
    (this.tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Exploratory'),
    ),
  );

  hasSpotCheck = computed(() =>
    (this.tasksTestedData() ?? []).some((task) =>
      task.tests.some((t) => t.testType === 'Spot Check'),
    ),
  );

  readonly testTypeBarColors: Record<string, string> = {
    Baseline: globalColours[0],
    Validation: globalColours[1],
    Exploratory: globalColours[2],
    'Spot Check': globalColours[3],
  };

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
