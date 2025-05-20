import { logJson, Mutex } from '@dua-upd/utils-common';
import type { DateRange } from '@dua-upd/types-common';
import type { DbViewNew } from '../db.views.new';

type DateRangeManager = {
  lastKnownRefresh: Date | null;
  mutex: Mutex;
};

export class ViewDataService {
  private readonly dateRangeManagers = new Map<string, DateRangeManager>();

  // "Global" mutex to avoid race conditions from concurrent access
  private readonly mutex = new Mutex();

  constructor(private view: DbViewNew<any, any, any, any>) {}

  private async getDateRangeManager(dateRange: DateRange<Date>) {
    await this.mutex.lock();

    try {
      const dateRangeString = dateRangeToString(dateRange);

      if (!this.dateRangeManagers.has(dateRangeString)) {
        this.registerDateRange(dateRange);
      }

      return this.dateRangeManagers.get(dateRangeString);
    } finally {
      this.mutex.unlock();
    }
  }

  async ensureData(dateRange: DateRange<Date>) {
    const dateRangeManager = await this.getDateRangeManager(dateRange);

    try {
      await dateRangeManager.mutex.lock();

      // Happy path where we have a last known refresh time in memory, and it's not past expiry
      if (
        dateRangeManager.lastKnownRefresh &&
        !this.view.isPastExpiry(dateRangeManager.lastKnownRefresh)
      ) {
        return;
      }

      // Make sure the last refresh time isn't from a source that doesn't exist anymore
      const maybeLastRefresh = await this.view.getLastUpdated(dateRange);

      const isMaybeExpired = this.view.isPastExpiry(maybeLastRefresh);

      if (isMaybeExpired) {
        const clearResults = await this.view.clearNonExisting();

        console.log(
          `Cleared documents from no-longer-existing sources in ${this.view.name}`,
        );
        logJson(clearResults);
      } else {
        dateRangeManager.lastKnownRefresh = maybeLastRefresh;
        return;
      }

      // Check the DB for last refresh time (for real)
      const lastRefresh = await this.view.getLastUpdated(dateRange);

      dateRangeManager.lastKnownRefresh = lastRefresh;

      const isExpired = this.view.isPastExpiry(lastRefresh);

      if (!isExpired) {
        return;
      }

      // todo: use external logger
      console.log(
        `ViewDataService: Refreshing data for ${this.view.name} (${dateRangeToString(dateRange)})`,
      );

      // If it's expired, refresh the data
      await this.view.performRefresh({ dateRange });
    } finally {
      dateRangeManager.mutex.unlock();
    }
  }

  private registerDateRange(dateRange: DateRange<Date>) {
    const dateRangeString = dateRangeToString(dateRange);

    if (!this.dateRangeManagers.has(dateRangeString)) {
      this.dateRangeManagers.set(dateRangeString, {
        lastKnownRefresh: null,
        mutex: new Mutex(),
      });
    }
  }
}

const dateRangeToString = (dateRange: DateRange<Date>) =>
  `${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
