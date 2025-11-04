import { mapObject } from 'rambdax';
import {
  arrayToDictionary,
  dateRangeConfigs,
  DateRangeConfig,
} from '@dua-upd/utils-common';

// Use to look up specific period types
const _dateRangeConfigs = arrayToDictionary(
  dateRangeConfigs as DateRangeConfig[],
  'type',
);

function getDateRangesWithComparison(date: Date) {
  return mapObject(({ type }) => {
    const periodConfig = _dateRangeConfigs[type];

    const dateRange = periodConfig.getDateRange(date);

    const comparisonDateRange = {
      start: periodConfig.getComparisonDate(dateRange.start),
      end: periodConfig.getComparisonDate(dateRange.end),
    };

    return {
      label: periodConfig.label,
      date_range: dateRange,
      comparison_date_range: comparisonDateRange,
    };
  }, _dateRangeConfigs);
}

const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;

console.log('Starting server on http://localhost:3123');

Bun.serve({
  port: 3123,
  routes: {
    '/date-ranges': async (req) => {
      console.log('Received request:', req.url);

      const url = new URL(req.url);
      const dateParam = url.searchParams.get('date');

      if (dateParam && !dateFormatRegex.test(dateParam)) {
        return Response.json(
          { error: 'Invalid date format. Use YYYY-MM-DD.' },
          { status: 400 },
        );
      }

      if (!dateParam) {
        return Response.json(
          { error: 'Missing "date" query parameter' },
          { status: 400 },
        );
      }

      const date = new Date(dateParam);

      const result = getDateRangesWithComparison(date);

      return Response.json(result);
    },
  },
});
