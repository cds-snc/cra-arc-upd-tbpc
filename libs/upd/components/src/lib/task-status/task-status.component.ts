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

type PerformanceBand = 'poor' | 'low' | 'good' | 'great';
type TrendBand = 'higher' | 'normal' | 'lower';
type Tier = 'green' | 'yellow' | 'blue' | 'red' | 'grey';
type ScoreMetricKey = 'calls' | 'feedback' | 'survey';

type StatusView = {
  tier: Tier;
  badge: string;
  situation: string;
  title: string;
  note: string;
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

  readonly relativeRanges = computed<ScoreRange<PerformanceBand>[]>(() => [
    {
      key: 'poor',
      name: this.translate('task-status-range-poor'),
      from: 0,
      to: 35,
      color: '#d93025',
    },
    {
      key: 'low',
      name: this.translate('task-status-range-low'),
      from: 36,
      to: 49,
      color: '#f2a93b',
    },
    {
      key: 'good',
      name: this.translate('task-status-range-good'),
      from: 50,
      to: 64,
      color: '#75c962',
    },
    {
      key: 'great',
      name: this.translate('task-status-range-great'),
      from: 65,
      to: 100,
      color: '#1f9d55',
    },
  ]);

  readonly historicalRanges = computed<ScoreRange<TrendBand>[]>(() => [
    {
      key: 'lower',
      name: this.translate('task-status-range-lower'),
      from: -100,
      to: -5,
      color: '#b42318',
    },
    {
      key: 'normal',
      name: this.translate('task-status-range-normal'),
      from: -5,
      to: 5,
      color: '#f2b632',
    },
    {
      key: 'higher',
      name: this.translate('task-status-range-higher'),
      from: 5,
      to: 100,
      color: '#2f7d4d',
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
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      situation: this.translate('task-status-situation-low-higher'),
      title: this.translate('task-status-title-low-higher'),
      note: this.translate('task-status-note-monitor'),
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
      tier: 'yellow',
      badge: this.translate('task-status-badge-watch'),
      situation: this.translate('task-status-situation-poor-higher'),
      title: this.translate('task-status-title-poor-higher'),
      note: this.translate('task-status-note-monitor'),
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
    const score = this.ps()!;

    if (score >= 0.65) return 'great';
    if (score >= 0.5) return 'good';
    if (score >= 0.36) return 'low';

    return 'poor';
  });

  trendBand = computed<TrendBand>(() => {
    const variance = this.ps()! - this.ha()!;

    if (variance > this.historicalVarianceThreshold) return 'higher';
    if (variance < -this.historicalVarianceThreshold) return 'lower';

    return 'normal';
  });

  shaVariance = computed(() => {
    const sha = this.sha();

    if (sha == null || Number.isNaN(sha)) {
      return null;
    }

    return this.ps()! - sha;
  });

  historicalVariance = computed(() => this.ps()! - this.ha()!);

  statusKey = computed(() => `${this.performanceBand()}-${this.trendBand()}`);

  status = computed(
    () => this.statusMap()[this.statusKey()] ?? this.statusMap()['poor-lower'],
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

    return typeof score === 'number' && Number.isFinite(score);
  });

  hasHistoricalAverage = computed(() => {
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
