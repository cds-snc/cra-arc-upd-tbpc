import {
  dimensionNamesMap,
  dimensions,
  metricNamesMap,
  metrics,
} from '@dua-upd/types-common';
import type {
  AAMetricName,
  AAMetricsConfig,
  AADimensionName,
  AAReportDimensionId,
} from '@dua-upd/types-common';

export const metricsConfig = (
  _metrics: AAMetricName | AAMetricName[],
): AAMetricsConfig => {
  const metricNames = Array.isArray(_metrics) ? _metrics : [_metrics];

  return Object.fromEntries(
    metricNames.map((metricName) => [metricName, metrics[metricName]]),
  );
};

export const metricToFriendlyName = (metric: AAMetricName) =>
  metricNamesMap[metric];

export const dimension = (dimension: AADimensionName): AAReportDimensionId =>
  dimensions[dimension];

export const dimensionToFriendlyName = (dimension: AAReportDimensionId) =>
  dimensionNamesMap[dimension];
