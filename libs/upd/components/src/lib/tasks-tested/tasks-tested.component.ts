import { formatPercent } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { globalColours } from '@dua-upd/utils-common';

export interface ScenarioTestedData {
  scenarioNumber: number;
  scenarioDescriptions: {
    label: string;
    text: string;
    html?: string | null;
  }[];
  connectedTasks: { title: string; id: string }[];
  tests: {
    testType: string;
    testTypeLabel: string;
    successRate: number | null;
    successRatePercent: number | null;
  }[];
  avgTaskSuccessPointChange: number | null;
  avgTaskSuccessPercentChange: number | null;
}

export interface TasksTestedSummary {
  tasksCount: number;
  scenariosCount: number;
}

interface ChangeIndicator {
  text: string;
  cssClass: 'text-success' | 'text-danger' | 'text-muted';
  arrow: 'arrow_upward' | 'arrow_downward' | '';
}

@Component({
  selector: 'upd-tasks-tested',
  templateUrl: './tasks-tested.component.html',
  styleUrls: ['./tasks-tested.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksTestedComponent {
  private i18n = inject(I18nFacade);
  scenariosTestedData = input<ScenarioTestedData[] | null>(null);
  tasksTestedSummary = input<TasksTestedSummary | null>(null);
  totalParticipants = input<number | null>(null);
  langLink = input('en');
  readonly currentLang = this.i18n.currentLang;

  hasData = computed(() => {
    const data = this.scenariosTestedData();
    return data && data.length > 0;
  });

  hasBaseline = computed(() =>
    (this.scenariosTestedData() ?? []).some((scenario) =>
      scenario.tests.some((t) => t.testType === 'Baseline'),
    ),
  );

  hasValidation = computed(() =>
    (this.scenariosTestedData() ?? []).some((scenario) =>
      scenario.tests.some((t) => t.testType === 'Validation'),
    ),
  );

  hasExploratory = computed(() =>
    (this.scenariosTestedData() ?? []).some((scenario) =>
      scenario.tests.some((t) => t.testType === 'Exploratory'),
    ),
  );

  hasSpotCheck = computed(() =>
    (this.scenariosTestedData() ?? []).some((scenario) =>
      scenario.tests.some((t) => t.testType === 'Spot Check'),
    ),
  );

  readonly testTypeBarColors: Record<string, string> = {
    Baseline: globalColours[0],
    Validation: globalColours[1],
    Exploratory: globalColours[2],
    'Spot Check': globalColours[3],
  };

  getChangeIndicator(value: number | null, locale: string): ChangeIndicator {
    if (value == null || !Number.isFinite(value)) {
      return {
        text: '-',
        cssClass: 'text-muted',
        arrow: '',
      };
    }

    return {
      text: formatPercent(Math.abs(value) / 100, locale, '1.0-0'),
      cssClass:
        value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted',
      arrow: value > 0 ? 'arrow_upward' : value < 0 ? 'arrow_downward' : '',
    };
  }
}
