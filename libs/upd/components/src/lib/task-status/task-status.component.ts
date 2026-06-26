import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';

type ScoreRange<T extends string = string> = {
  key: T;
  name: string;
  from: number;
  to: number;
  color: string;
};

type PerformanceBand = 'poor' | 'low' | 'good' | 'great';
type TrendBand = 'higher' | 'normal' | 'lower';
type Tier = 'green' | 'yellow' | 'blue' | 'red' | 'grey';

type StatusView = {
  tier: Tier;
  badge: string;
  situation: string;
  title: string;
  note: string;
};

@Component({
  selector: 'upd-task-status',
  templateUrl: './task-status.component.html',
  styleUrls: ['./task-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TaskStatusComponent {
  ps = input(0);
  ha = input(0);
  sha = input(0);
  rpsChange = input(0);
  hpsChange = input(0);
  shaChange = input(0);
  tmfRank = input(0);
  tmfTotalTasks = input(0);
  calls = input(0);
  feedback = input(0);
  survey = input(0);

  hasData = computed(() => {
    return !!(
      this.hasPerformanceScore() &&
      this.ha() !== null &&
      this.ha() !== 0
    );
  });

  private i18n = inject(I18nFacade);
  readonly currentLang = this.i18n.currentLang;

  private readonly historicalVarianceThreshold = 0.05;

  private translate(key: string): string {
    this.currentLang();

    return this.i18n.service.instant(key);
  }

readonly relativeRanges = computed<ScoreRange<PerformanceBand>[]>(() => [
  {
    key: 'poor',
    name: this.translate('task-status-range-poor'),
    from: 0,
    to: 35,
    color: '#b42318',
  },
  {
    key: 'low',
    name: this.translate('task-status-range-low'),
    from: 36,
    to: 49,
    color: '#fff0cf',
  },
  {
    key: 'good',
    name: this.translate('task-status-range-good'),
    from: 50,
    to: 64,
    color: '#dff3e8',
  },
  {
    key: 'great',
    name: this.translate('task-status-range-great'),
    from: 65,
    to: 100,
    color: '#b9dfc9',
  },
]);

readonly historicalRanges = computed<ScoreRange<TrendBand>[]>(() => [
  {
    key: 'lower',
    name: this.translate('task-status-range-lower'),
    from: -100,
    to: -0.05,
    color: '#b42318',
  },
  {
    key: 'normal',
    name: this.translate('task-status-range-normal'),
    from: -0.05,
    to: 0.05,
    color: '#d38e26',
  },
  {
    key: 'higher',
    name: this.translate('task-status-range-higher'),
    from: 0.05,
    to: 100,
    color: '#006b3f',
  },
]);

  private readonly statusMap = computed<Record<string, StatusView>>(() => ({
    'great-higher': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      situation: this.translate('task-status-situation-great-higher'),
      title: this.translate('task-status-title-great-higher'),
      note: this.translate('task-status-note-no-action'),
    },

    'great-normal': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      situation: this.translate('task-status-situation-great-normal'),
      title: this.translate('task-status-title-great-normal'),
      note: this.translate('task-status-note-no-action'),
    },

    'great-lower': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      situation: this.translate('task-status-situation-great-lower'),
      title: this.translate('task-status-title-great-lower'),
      note: this.translate('task-status-note-monitor'),
    },

    'good-higher': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      situation: this.translate('task-status-situation-good-higher'),
      title: this.translate('task-status-title-good-higher'),
      note: this.translate('task-status-note-no-action'),
    },

    'good-normal': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      situation: this.translate('task-status-situation-good-normal'),
      title: this.translate('task-status-title-good-normal'),
      note: this.translate('task-status-note-no-action'),
    },

    'good-lower': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      situation: this.translate('task-status-situation-good-lower'),
      title: this.translate('task-status-title-good-lower'),
      note: this.translate('task-status-note-monitor'),
    },

    'low-higher': {
      tier: 'blue',
      badge: this.translate('task-status-badge-improving'),
      situation: this.translate('task-status-situation-low-higher'),
      title: this.translate('task-status-title-low-higher'),
      note: this.translate('task-status-note-progress'),
    },

    'low-normal': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      situation: this.translate('task-status-situation-low-normal'),
      title: this.translate('task-status-title-low-normal'),
      note: this.translate('task-status-note-monitor'),
    },

    'low-lower': {
      tier: 'red',
      badge: this.translate('task-status-badge-needs-action'),
      situation: this.translate('task-status-situation-low-lower'),
      title: this.translate('task-status-title-low-lower'),
      note: this.translate('task-status-note-prioritize'),
    },

    'poor-higher': {
      tier: 'blue',
      badge: this.translate('task-status-badge-improving'),
      situation: this.translate('task-status-situation-poor-higher'),
      title: this.translate('task-status-title-poor-higher'),
      note: this.translate('task-status-note-progress'),
    },

    'poor-normal': {
      tier: 'red',
      badge: this.translate('task-status-badge-needs-action'),
      situation: this.translate('task-status-situation-poor-normal'),
      title: this.translate('task-status-title-poor-normal'),
      note: this.translate('task-status-note-prioritize'),
    },

    'poor-lower': {
      tier: 'red',
      badge: this.translate('task-status-badge-needs-action'),
      situation: this.translate('task-status-situation-poor-lower'),
      title: this.translate('task-status-title-poor-lower'),
      note: this.translate('task-status-note-prioritize'),
    },
  }));

  performanceBand = computed<PerformanceBand>(() => {
    const score = this.ps();

    if (score >= 0.65) return 'great';
    if (score >= 0.5) return 'good';
    if (score >= 0.36) return 'low';

    return 'poor';
  });

  trendBand = computed<TrendBand>(() => {
    const variance = this.ps() - this.ha();

    if (variance > this.historicalVarianceThreshold) return 'higher';
    if (variance < -this.historicalVarianceThreshold) return 'lower';

    return 'normal';
  });

  shaVariance = computed(() => {
    const sha = this.sha();

    if (sha == null || Number.isNaN(sha)) {
      return null;
    }

    return this.ps() - sha;
  });

  historicalVariance = computed(() => this.ps() - this.ha());

  statusKey = computed(() => `${this.performanceBand()}-${this.trendBand()}`);

  status = computed(
    () => this.statusMap()[this.statusKey()] ?? this.statusMap()['poor-lower'],
  );

  readonly healthLabel = computed(() => this.healthBadge());

  readonly healthTier = computed<Tier>(() => {
    if (!this.hasPerformanceScore()) {
      return 'grey';
    }

    return this.status().tier;
  });

  readonly healthBadge = computed(() => {
    if (!this.hasPerformanceScore()) {
      return this.translate('task-status-badge-unscored');
    }

    return this.status().badge;
  });

  readonly healthTitle = computed(() => this.status().title);

  readonly healthNote = computed(() => this.status().note);

  readonly haConfidenceTitle = computed(() => {
    const trend = this.trendBand();

    if (trend === 'higher') {
      return this.translate('task-status-ha-above');
    }

    if (trend === 'lower') {
      return this.translate('task-status-ha-below');
    }

    return this.translate('task-status-ha-normal');
  });

  readonly psConfidenceTitle = computed(() => {
    const band = this.performanceBand();

    switch (band) {
      case 'great':
        return this.translate('task-status-ps-great');

      case 'good':
        return this.translate('task-status-ps-good');

      case 'low':
        return this.translate('task-status-ps-low');

      default:
        return this.translate('task-status-ps-poor');
    }
  });

  readonly shaConfidenceTitle = computed(() => {
    const variance = this.shaVariance();

    if (variance == null) {
      return this.translate('task-status-sha-unavailable');
    }

    if (variance > this.historicalVarianceThreshold) {
      return this.translate('task-status-sha-above');
    }

    if (variance < -this.historicalVarianceThreshold) {
      return this.translate('task-status-sha-below');
    }

    return this.translate('task-status-sha-normal');
  });

  hasPerformanceScore = computed(() => {
    const score = this.ps();

    return (
      score !== null &&
      typeof score === 'number' &&
      Number.isFinite(score) &&
      score !== 0
    );
  });

  readonly confidenceCalloutLead = computed(() => {
    const performance = this.translate(
      `task-status-range-${this.performanceBand()}`,
    );

    const trend = this.translate(`task-status-range-${this.trendBand()}`);

    return `${performance} + ${trend} = ${this.healthBadge()}.`;
  });

  tmfTopPercent = computed(() => {
    const rank = this.tmfRank();
    const total = this.tmfTotalTasks();

    if (!rank || !total) return 0;

    return Math.ceil((rank / total) * 100);
  });

  readonly confidenceCalloutText = computed(() => {
    switch (this.healthTier()) {
      case 'green':
        return this.translate('task-status-callout-healthy');

      case 'yellow':
        return this.translate('task-status-callout-watch');

      case 'blue':
        return this.translate('task-status-callout-improving');

      case 'red':
        return this.translate('task-status-callout-needs-action');

      default:
        return '';
    }
  });

  readonly scoreMetrics = computed(() => [
    {
      label: this.translate('task-status-metric-calls'),
      included: this.calls(),
    },
    {
      label: this.translate('task-status-metric-negative-feedback'),
      included: this.feedback(),
    },
    {
      label: this.translate('task-status-metric-survey'),
      included: this.survey(),
    },
  ]);

  availableMetricCount = computed(
    () => this.scoreMetrics().filter((metric) => metric.included).length,
  );

  getChangeClass(change: number): string {
    if (change > this.historicalVarianceThreshold) return 'change-good';
    if (change < -this.historicalVarianceThreshold) return 'change-bad';

    return 'change-neutral';
  }

  getArrow(value: number): string {
    if (value < 0) return 'arrow_downward';
    if (value > 0) return 'arrow_upward';

    return '';
  }

  getAbsChange(value: number): number {
    return Math.abs(value);
  }
}
