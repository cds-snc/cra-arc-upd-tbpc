import { isNullish } from './utils-common';

const METRIC_KEYS = ['visits', 'calls', 'dyf_total', 'survey'] as const;

type Metric = (typeof METRIC_KEYS)[number];

type DistributionStats = {
  min: number;
  max: number;
  p5: number;
  p95: number;
};

type StatsByMetric = {
  [key in Metric]: DistributionStats;
};

type MetricWeights = {
  [key in Metric]: number;
};

export type TaskRankingParams = {
  visits: number;
  calls: number;
  dyf_total: number;
  survey: number;
  status?: string; // For excluding inactive tasks from global stats/ranking
};

export const METRIC_WEIGHTS: MetricWeights = {
  visits: 50,
  calls: 30,
  dyf_total: 10,
  survey: 10,
};

const calculatePercentile = (
  sortedAsc: number[],
  percentile: number,
): number => {
  const size = sortedAsc.length;
  const rank = 1 + (size - 1) * percentile;
  const lowerRank = Math.floor(rank);
  const fraction = rank - lowerRank;
  const lowerValue = sortedAsc[lowerRank - 1];
  const upperValue = sortedAsc[lowerRank];

  return lowerValue + fraction * (upperValue - lowerValue);
};

const computeDistributionStats = (arr: number[]): DistributionStats => {
  const data = arr.filter((v) => typeof v === 'number' && Number.isFinite(v));

  if (data.length === 0) {
    return { min: NaN, max: NaN, p5: NaN, p95: NaN };
  }

  const sorted = data.toSorted((a, b) => a - b);

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p5 = calculatePercentile(sorted, 0.05);
  const p95 = calculatePercentile(sorted, 0.95);

  return { min, max, p5, p95 };
};

const normalizeWithinPercentileRange = (
  rawValue: number,
  p5th: number,
  p95th: number,
): number | null => {
  if (
    !Number.isFinite(rawValue) ||
    !Number.isFinite(p5th) ||
    !Number.isFinite(p95th)
  ) {
    return null;
  }

  const span = p95th - p5th;

  if (!(span > 0)) {
    return null;
  }

  const clamped = Math.max(Math.min(rawValue, p95th), p5th);

  return (clamped - p5th) / span;
};

const tailBonusAboveP95 = (
  rawValue: number,
  p95th: number,
  rawMax: number,
  tailCap: number,
): number => {
  if (
    !Number.isFinite(rawValue) ||
    !Number.isFinite(p95th) ||
    !Number.isFinite(rawMax) ||
    !(rawValue > p95th) ||
    !(rawMax > p95th) ||
    !(tailCap > 0)
  ) {
    return 0;
  }

  const tailSpan = rawMax - p95th;
  const proportion = (rawValue - p95th) / tailSpan;

  return Math.max(0, Math.min(1, proportion)) * tailCap;
};

export function computeMetricWeightedScore(
  rawValue: number,
  p5th: number,
  p95th: number,
  maxVal: number,
  weight: number,
): number {
  const base = normalizeWithinPercentileRange(rawValue, p5th, p95th);

  if (isNullish(base)) {
    return 0;
  }

  const tailCap = 1 / weight;
  const tail = tailBonusAboveP95(rawValue, p95th, maxVal, tailCap);

  return base * (weight - 1) + tail * weight;
}

export function getGlobalMetricStats(
  tasks: TaskRankingParams[],
): StatsByMetric {
  const visits: number[] = [];
  const calls: number[] = [];
  const dyf_total: number[] = [];
  const survey: number[] = [];

  const pushValid = (array: number[], n: number) => {
    if (Number.isFinite(n) && n !== 0) {
      array.push(n);
    }
  };

  for (const t of tasks ?? []) {
    // Skip inactive tasks for global stats
    if (t.status === 'Inactive') {
      continue;
    }

    pushValid(visits, t['visits']);
    pushValid(calls, t['calls']);
    pushValid(dyf_total, t['dyf_total']);
    pushValid(survey, t['survey']);
  }

  return {
    visits: computeDistributionStats(visits),
    calls: computeDistributionStats(calls),
    dyf_total: computeDistributionStats(dyf_total),
    survey: computeDistributionStats(survey),
  };
}

type TmfScoresAndRank = {
  [key in `${Metric}_score`]: number;
} & {
  overall_score: number;
  tmf_rank: number;
};

export function calculateTaskScores<T extends TaskRankingParams>(
  task: T,
  globalStats: StatsByMetric,
) {
  const taskScores = Object.fromEntries(
    METRIC_KEYS.map((metric) => [
      `${metric}_score`,
      computeMetricWeightedScore(
        task[metric],
        globalStats[metric].p5,
        globalStats[metric].p95,
        globalStats[metric].max,
        METRIC_WEIGHTS[metric],
      ),
    ]),
  ) as {
    [key in Metric as `${key}_score`]: number;
  };

  return {
    ...task,
    ...taskScores,
    overall_score: Object.values(taskScores).reduce((a, b) => a + b, 0),
  };
}

export function addTmfScoresToTasks<T extends TaskRankingParams>(
  tasks: T[],
): (T & TmfScoresAndRank)[] {
  const globalStats = getGlobalMetricStats(tasks);

  return tasks
    .map((t: T) => calculateTaskScores(t, globalStats))
    .sort((a, b) => {
      // Inactive tasks always rank lowest
      const aIfActive = a.status === 'Inactive' ? 0 : a.overall_score;
      const bIfActive = b.status === 'Inactive' ? 0 : b.overall_score;
      return bIfActive - aIfActive;
    })
    .map((t, i) => ({
      ...t,
      tmf_rank: i + 1,
    }));
}
