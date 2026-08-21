import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { HighDemandMetric } from '@dua-upd/utils-common';

type ScoreRange<T extends string = string> = {
  key: T;
  name: string;
  from: number;
  to: number;
  color: string;
};

type HighDemandTooltipMetric = {
  key: HighDemandMetric;
  label: string;
  value: number;
  highDemand: boolean;
};

export type PerformanceBand = 'poor' | 'fair' | 'good' | 'strong';
export type TrendBand = 'improving' | 'steady' | 'declining';
type Tier = 'green' | 'yellow' | 'blue' | 'red' | 'grey';
type ScoreMetricKey = 'calls' | 'feedback' | 'survey';

type StatusView = {
  tier: Tier;
  badge: string;
  title: string;
};

type ScoreMetric = {
  key: ScoreMetricKey;
  label: string;
  included: boolean;
  value: number | null;
};

@Component({
  selector: 'upd-task-status',
  templateUrl: './task-status.component.html',
  styleUrls: ['./task-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TaskStatusComponent {
  ps = input<number | null>(null);
  ha = input<number | null>(null);
  sha = input(0);
  rpsChange = input(0);
  hpsChange = input(0);
  shaChange = input(0);
  tmfRank = input(0);
  tmfTotalTasks = input(0);
  calls = input(0);
  feedback = input(0);
  survey = input<number | null>(null);
  surveyCompleted = input(0);
  surveyTotal = input(0);
  visitsVolume = input(0);
  callsVolume = input(0);
  feedbackVolume = input(0);
  highDemandMetrics = input<HighDemandMetric[]>([]);

  hasData = computed(() => {
    return !!(this.hasPerformanceScore() && this.hasHistoricalAverage());
  });

  private i18n = inject(I18nFacade);
  readonly currentLang = this.i18n.currentLang;

  private readonly historicalVarianceThreshold = 0.05;

  private translate(key: string, params?: Record<string, unknown>): string {
    this.currentLang();

    return this.i18n.service.instant(key, params);
  }

  private readonly highDemandMetricLabels = computed<
    Record<HighDemandMetric, string>
  >(() => ({
    visits: this.translate('task-status-high-demand-metric-visits'),
    calls: this.translate('task-status-high-demand-metric-calls'),
    dyf_no: this.translate('task-status-high-demand-metric-negative-feedback'),
  }));

  readonly hasHighDemand = computed(() => this.highDemandMetrics().length > 0);

  readonly highDemandTooltipMetrics = computed<
    readonly HighDemandTooltipMetric[]
  >(() => {
    const labels = this.highDemandMetricLabels();
    const highDemandMetrics = new Set(this.highDemandMetrics());

    return [
      {
        key: 'visits',
        label: labels.visits,
        value: this.visitsVolume(),
        highDemand: highDemandMetrics.has('visits'),
      },
      {
        key: 'calls',
        label: labels.calls,
        value: this.callsVolume(),
        highDemand: highDemandMetrics.has('calls'),
      },
      {
        key: 'dyf_no',
        label: labels.dyf_no,
        value: this.feedbackVolume(),
        highDemand: highDemandMetrics.has('dyf_no'),
      },
    ];
  });

  private readonly conjunctionListFormatter = computed(
    () =>
      new Intl.ListFormat(this.currentLang(), {
        style: 'long',
        type: 'conjunction',
      }),
  );

  readonly highDemandMetricList = computed(() => {
    const metrics = this.highDemandTooltipMetrics()
      .filter(({ highDemand }) => highDemand)
      .map(({ label }) => label.toLocaleLowerCase(this.currentLang()));

    return this.conjunctionListFormatter().format(metrics);
  });

  readonly currentRelativeRange = computed(
    () =>
      this.relativeRanges().find(({ key }) => key === this.performanceBand())!,
  );

  readonly trendLabel = computed(() =>
    this.translate(`task-status-range-${this.trendBand()}`),
  );

  readonly trendIcon = computed(() => {
    switch (this.trendBand()) {
      case 'improving':
        return 'arrow_upward';

      case 'declining':
        return 'arrow_downward';

      default:
        return 'arrow_right_alt';
    }
  });

  readonly trendClass = computed(() => {
    switch (this.trendBand()) {
      case 'improving':
        return 'change-good';

      case 'declining':
        return 'change-bad';

      default:
        return 'change-neutral';
    }
  });

  readonly relativeRanges = computed<ScoreRange<PerformanceBand>[]>(() => [
    {
      key: 'poor',
      name: this.translate('task-status-range-poor'),
      from: 0,
      to: 49,
      color: '#d93025',
    },
    {
      key: 'fair',
      name: this.translate('task-status-range-fair'),
      from: 50,
      to: 59,
      color: '#f2a93b',
    },
    {
      key: 'good',
      name: this.translate('task-status-range-good'),
      from: 60,
      to: 79,
      color: '#158898',
    },
    {
      key: 'strong',
      name: this.translate('task-status-range-strong'),
      from: 80,
      to: 100,
      color: '#1f9d55',
    },
  ]);

  readonly historicalRanges = computed<ScoreRange<TrendBand>[]>(() => [
    {
      key: 'declining',
      name: this.translate('task-status-range-declining'),
      from: -100,
      to: -5,
      color: '#b42318',
    },
    {
      key: 'steady',
      name: this.translate('task-status-range-steady'),
      from: -5,
      to: 5,
      color: '#d38e26',
    },
    {
      key: 'improving',
      name: this.translate('task-status-range-improving'),
      from: 5,
      to: 100,
      color: '#006b3f',
    },
  ]);

  private readonly statusMap = computed<Record<string, StatusView>>(() => ({
    'strong-improving': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      title: this.translate('task-status-title-strong-improving'),
    },
    'strong-steady': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      title: this.translate('task-status-title-strong-steady'),
    },
    'strong-declining': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      title: this.translate('task-status-title-strong-declining'),
    },

    'good-improving': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      title: this.translate('task-status-title-good-improving'),
    },
    'good-steady': {
      tier: 'green',
      badge: this.translate('task-status-badge-healthy'),
      title: this.translate('task-status-title-good-steady'),
    },
    'good-declining': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      title: this.translate('task-status-title-good-declining'),
    },

    'fair-improving': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      title: this.translate('task-status-title-fair-improving'),
    },
    'fair-steady': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      title: this.translate('task-status-title-fair-steady'),
    },
    'fair-declining': {
      tier: 'red',
      badge: this.translate('task-status-badge-needs-action'),
      title: this.translate('task-status-title-fair-declining'),
    },

    'poor-improving': {
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      title: this.translate('task-status-title-poor-improving'),
    },
    'poor-steady': {
      tier: 'red',
      badge: this.translate('task-status-badge-needs-action'),
      title: this.translate('task-status-title-poor-steady'),
    },
    'poor-declining': {
      tier: 'red',
      badge: this.translate('task-status-badge-needs-action'),
      title: this.translate('task-status-title-poor-declining'),
    },
  }));

  readonly performanceBand = computed<PerformanceBand>(() => {
    const score = this.ps();

    if (score == null) return 'poor';

    if (score >= 0.8) return 'strong';
    if (score >= 0.6) return 'good';
    if (score >= 0.5) return 'fair';

    return 'poor';
  });

  readonly trendBand = computed<TrendBand>(() => {
    const score = this.ps();
    const historicalAverage = this.ha();

    if (score == null || historicalAverage == null) {
      return 'steady';
    }

    const variance = score - historicalAverage;

    if (variance > this.historicalVarianceThreshold) {
      return 'improving';
    }

    if (variance < -this.historicalVarianceThreshold) {
      return 'declining';
    }

    return 'steady';
  });

  shaVariance = computed(() => {
    const sha = this.sha();

    if (sha == null || Number.isNaN(sha)) {
      return null;
    }

    return this.ps()! - sha;
  });

  historicalVariance = computed(() => this.ps()! - this.ha()!);

  readonly statusKey = computed(
    () => `${this.performanceBand()}-${this.trendBand()}`,
  );

  readonly status = computed(
    () =>
      this.statusMap()[this.statusKey()] ?? this.statusMap()['poor-declining'],
  );

  readonly healthLabel = computed(() => this.healthBadge());

  readonly healthTier = computed<Tier>(() => {
    if (!this.hasData()) {
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

  readonly highImpactTitle = computed<string | null>(() => {
    if (!this.hasHighDemand()) {
      return null;
    }

    return this.translate(`task-status-title-${this.statusKey()}-high-impact`, {
      metrics: this.highDemandMetricList(),
    });
  });

  readonly haConfidenceTitle = computed(() => {
    const trend = this.trendBand();

    if (trend === 'improving') {
      return this.translate('task-status-ha-above');
    }

    if (trend === 'declining') {
      return this.translate('task-status-ha-below');
    }

    return this.translate('task-status-ha-normal');
  });

  readonly psConfidenceTitle = computed(() => {
    const band = this.performanceBand();

    switch (band) {
      case 'strong':
        return this.translate('task-status-ps-great');

      case 'good':
        return this.translate('task-status-ps-good');

      case 'fair':
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

    return typeof score === 'number' && Number.isFinite(score);
  });

  readonly hasHistoricalAverage = computed(() => {
    const historicalAverage = this.ha();

    return (
      typeof historicalAverage === 'number' &&
      Number.isFinite(historicalAverage) &&
      historicalAverage >= 0
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

  readonly successfulSurveyParticipants = computed<number | null>(() => {
    const score = this.survey();
    const total = this.surveyTotal();

    if (
      score === null ||
      !Number.isFinite(score) ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return null;
    }

    return Math.round(score * total);
  });

  readonly scoreMetrics = computed<ScoreMetric[]>(() => {
    const survey = this.survey();
    const hasSurvey = survey !== null && Number.isFinite(survey);

    return [
      {
        key: 'calls',
        label: this.translate('task-status-metric-calls'),
        included: Boolean(this.calls()),
        value: this.calls(),
      },
      {
        key: 'feedback',
        label: this.translate('task-status-metric-negative-feedback'),
        included: Boolean(this.feedback()),
        value: this.feedback(),
      },
      {
        key: 'survey',
        label: this.translate('task-status-metric-survey'),
        included: hasSurvey,
        value: survey,
      },
    ];
  });

  availableMetricCount = computed(
    () => this.scoreMetrics().filter((metric) => metric.included).length,
  );

  readonly unscoredTitleKey = computed(() => {
    if (this.availableMetricCount() < 2) {
      return 'task-status-performance-score-unavailable';
    }

    if (!this.hasHistoricalAverage()) {
      return 'task-status-performance-score-pending';
    }

    return 'task-status-performance-score-unavailable';
  });

  readonly unscoredMessageKey = computed(() => {
    const count = this.availableMetricCount();

    if (count < 2) {
      return 'task-status-unscored-message-insufficient-sources';
    }

    if (!this.hasHistoricalAverage()) {
      return 'task-status-unscored-message-no-historical-average';
    }

    return 'task-status-unscored-message-insufficient-sources';
  });

  getChangeClass(change: number): string {
    if (change > 0) return 'change-good';
    if (change < 0) return 'change-bad';

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
