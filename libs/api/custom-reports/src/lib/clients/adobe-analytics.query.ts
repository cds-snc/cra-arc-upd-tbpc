import { AdobeAnalyticsQueryBuilder } from '@dua-upd/node-utils';
import {
  defaultQuerySettings,
} from '@dua-upd/types-common';
import type {
  AAQueryConfig,
  Direction,
  ReportSettings,
} from '@dua-upd/types-common';
import { dimension, metricsConfig } from './adobe-analytics.config';

export function createQuery(config: AAQueryConfig) {
  const queryBuilder = new AdobeAnalyticsQueryBuilder();

  const { dateRange, metricNames, dimensionName, urls, direction, limit } =
    config;

  const settings: ReportSettings = limit
    ? {
        nonesBehavior: 'return-nones',
        countRepeatInstances: true,
        limit,
      }
    : defaultQuerySettings;

  const segmentDefinition =
    direction !== 'focal' && direction
      ? createFlowSegment(direction, urls)
      : createUrlSegment(urls, direction);

  const query = queryBuilder
    .setDimension(dimension(dimensionName))
    .setMetrics(metricsConfig(metricNames))
    .setGlobalFilters([
      {
        type: 'dateRange',
        dateRange: `${dateRange.start.replace(
          /z$/i,
          '',
        )}/${dateRange.end.replace(/z$/i, '')}`,
      },
      { type: 'segment', segmentDefinition },
      // <- breakdown goes here if not using dimension
    ])
    .setSettings(settings)
    .build();

  return query;
}

export function createFlowSegment(
  direction: Direction,
  urls: string | string[],
) {
  return {
    func: 'segment',
    container: {
      func: 'container',
      context: 'hits',
      pred: createPredicates(direction, urls),
    },
    version: [1, 0, 0],
  };
}

export function createPredicates(
  direction: Direction,
  urls: string | string[],
) {
  return {
    func: 'and',
    preds: [createContainerWithExists(), createSequence(direction, urls)],
  };
}

export function createSequence(direction: Direction, urls: string | string[]) {
  const stream: string[] = [];
  urls = Array.isArray(urls) ? urls : [urls];

  const addToStream = (items: any[]) => {
    stream.push(...items);
  };

  if (direction === 'previous') {
    addToStream([
      { func: 'exclude-next-checkpoint' },
      createContainerWithExists(),
      createContainerWithExists(),
    ]);
  }

  if (direction !== 'focal') {
    for (const url of urls) {
      const actions =
        direction === 'previous'
          ? [createDimensionRestriction(), createStreqPredicate(url)]
          : [createStreqPredicate(url), createDimensionRestriction()];

      addToStream(actions);
    }
  }

  if (direction === 'next') {
    addToStream([
      createContainerWithExists(),
      { func: 'exclude-next-checkpoint' },
      createContainerWithExists(),
    ]);
  }

  return {
    func: 'container',
    context: 'hits',
    pred: {
      func: direction === 'next' ? 'sequence-prefix' : 'sequence-suffix',
      context: 'visits',
      stream,
    },
  };
}

export function createContainerWithExists() {
  return {
    func: 'container',
    context: 'hits',
    pred: {
      func: 'exists',
      val: createAttribute(),
    },
  };
}

export function createStreqPredicate(url: string) {
  return {
    func: 'container',
    context: 'hits',
    pred: {
      func: 'streq',
      str: url,
      val: createAttribute(),
      description: 'Page URL Last 255 Chars (v22)',
    },
  };
}

export function createDimensionRestriction() {
  return {
    func: 'dimension-restriction',
    limit: 'within',
    count: 1,
    attribute: createAttribute(),
  };
}

export function createAttribute() {
  return {
    func: 'attr',
    name: dimension('url_last_255'),
    'allocation-model': {
      func: 'allocation-dedupedInstance',
      context: 'sessions',
    },
  };
}

export function createUrlSegment(
  urls: string | string[],
  direction?: Direction,
) {
  const pred = Array.isArray(urls)
    ? {
        func: 'streq-in',
        list: urls.map((url) => url.slice(-255)),
      }
    : {
        func: 'streq',
        str: urls.slice(-255),
      };

  const allocationModel =
    direction === 'focal'
      ? {
          'allocation-model': {
            func: 'allocation-dedupedInstance',
            context: 'sessions',
          },
        }
      : '';

  return {
    func: 'segment',
    container: {
      func: 'container',
      context: 'hits',
      pred: {
        ...pred,

        val: {
          func: 'attr',
          name: dimension('url_last_255'),
          ...allocationModel,
        },
        description: 'Page URL Last 255 Chars (v22)',
      },
    },
    version: [1, 0, 0],
  };
}
