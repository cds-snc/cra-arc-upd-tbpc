import type { Types } from 'mongoose';
import type { DateRange } from '@dua-upd/types-common';
import {
  getStructuredDateRangesWithComparison,
  datesFromDateRange,
  batchAwait,
  getDateRangesWithComparison,
  $trunc,
} from '@dua-upd/utils-common';
import type { DbService } from '../db.service';

export type MetricsByDay = {
  date: Date;
  task: Types.ObjectId;
  visits: number;
  dyfNo: number;
  dyfNoPerVisit: number | null;
  dyfYes: number;
};

// todo: adapt to be used for projects as well
export class TaskMetricsStore {
  private taskDateRangeMap: Map<string, MetricsByDay[]> = new Map();

  constructor(private db: DbService) {}

  get isLoaded() {
    return this.taskDateRangeMap.size > 0;
  }

  has(taskId: Types.ObjectId, dateRange: DateRange<Date>) {
    const key = `${taskId}-${dateRange.start.toISOString()}${dateRange.end.toISOString()}`;

    return this.taskDateRangeMap.has(key);
  }

  getMetricsByDay(taskId: Types.ObjectId, dateRange: DateRange<Date>) {
    const key = `${taskId}-${dateRange.start.toISOString()}${dateRange.end.toISOString()}`;

    return this.taskDateRangeMap.get(key);
  }

  async loadData() {
    const structuredDateRanges = getStructuredDateRangesWithComparison();

    const minStartDate = Object.values(structuredDateRanges)
      .map(({ comparisonDateRange: { start } }) => start)
      .sort((a, b) => a.diff(b))[0];

    const maxEndDate = Object.values(structuredDateRanges)
      .map(({ dateRange: { end } }) => end)
      .sort((a, b) => b.diff(a))[0];

    const fullDateRange: DateRange<Date> = {
      start: minStartDate.toDate(),
      end: maxEndDate.toDate(),
    };

    const dates = datesFromDateRange(fullDateRange, false, true) as Date[];

    const metricsByDay = await batchAwait(
      dates,
      (date) =>
        this.db.collections.pageMetrics
          .aggregate<{
            date: Date;
            task: Types.ObjectId;
            visits: number;
            dyfNo: number;
            dyfNoPerVisit: number | null;
            dyfYes: number;
          }>()
          .option({ allowDiskUse: false })
          .match({
            date,
            'tasks.0': { $exists: true },
          })
          .sort({ date: 1, tasks: 1 })
          .unwind({
            path: '$tasks',
            preserveNullAndEmptyArrays: false,
          })
          .group({
            _id: '$tasks',
            date: { $first: '$date' },
            visits: { $sum: '$visits' },
            dyf_no: { $sum: '$dyf_no' },
            dyf_yes: { $sum: '$dyf_yes' },
          })
          .project({
            _id: 0,
            date: 1,
            task: '$_id',
            visits: 1,
            dyfNo: '$dyf_no',
            dyfNoPerVisit: {
              $cond: [
                { $eq: ['$visits', 0] },
                null,
                $trunc({ $divide: ['$dyf_no', '$visits'] }, 6),
              ],
            },
            dyfYes: '$dyf_yes',
          })
          .exec(),
      30,
    ).then((results) => results.flat());

    const tasksMap = metricsByDay.reduce((acc, metrics) => {
      const taskId = metrics.task.toString();

      if (!acc.has(taskId)) {
        acc.set(taskId, []);
      }

      acc.get(taskId).push(metrics);

      return acc;
    }, new Map<string, MetricsByDay[]>());

    for (const metrics of tasksMap.values()) {
      metrics.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    const allDateRanges = getDateRangesWithComparison({
      asDate: true,
    }) as DateRange<Date>[];

    for (const taskId of tasksMap.keys()) {
      for (const dateRange of allDateRanges) {
        const key = `${taskId}-${dateRange.start.toISOString()}${dateRange.end.toISOString()}`;

        const metrics = tasksMap.get(taskId);

        const startIndex = metrics.findIndex(
          (metric) => metric.date.getTime() >= dateRange.start.getTime(),
        );

        const endIndex = metrics.findLastIndex(
          (metric) => metric.date.getTime() <= dateRange.end.getTime(),
        );

        this.taskDateRangeMap.set(key, metrics.slice(startIndex, endIndex + 1));
      }
    }
  }

  clearData() {
    this.taskDateRangeMap.clear();
  }
}
