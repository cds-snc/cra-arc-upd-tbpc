import { Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  createQuery,
  AA_CLIENT_TOKEN,
  AdobeAnalyticsClient,
} from '@dua-upd/adobe-analytics';
import { DbService } from '@dua-upd/db';
import { minutes } from '@dua-upd/utils-common';
import type { ReportConfig } from '@dua-upd/types-common';
import { CustomReportsCache } from './custom-reports.cache';
import { ChildJobMetadata } from './custom-reports.service';
import { processResults } from './custom-reports.strategies';

type ReportCreationMetadata = {
  id: string;
  config: ReportConfig<Date>;
  hash: string;
};

/**
 * Top-level processor for the `prepareReportData` queue.
 * This processor has as dependencies all sub-tasks needed
 * to prepare the data for the report.
 */
@Processor('prepareReportData', {
  concurrency: 1,
  maxStalledCount: 0,
  lockDuration: minutes(20),
  autorun: true,
})
export class PrepareReportDataProcessor extends WorkerHost {
  constructor(
    private db: DbService,
    private cache: CustomReportsCache,
  ) {
    super();
  }

  async process(job: Job<ReportCreationMetadata, void, string>) {
    try {
      const report = await this.db.collections.customReportsMetrics.getReport(
        job.data.config,
      );

      return report;
    } catch (err) {
      console.error('jobId: ', job.id);
      console.error((<Error>err).stack);
      throw err;
    }
  }
}

/**
 * Sub-level processor for the `fetchAndProcessReportData` queue.
 * Fetches and parses data from a datasource, and writes it to the db.
 */
@Processor('fetchAndProcessReportData', {
  concurrency: 20,
  maxStalledCount: 0,
  lockDuration: minutes(10),
  skipStalledCheck: true,
  limiter: {
    max: 10,
    duration: 500,
  },
})
export class FetchAndProcessDataProcessor extends WorkerHost {
  constructor(
    @Inject(AA_CLIENT_TOKEN) private aaClient: AdobeAnalyticsClient,
    private db: DbService,
  ) {
    super();
  }

  async process(job: Job<ChildJobMetadata, void, string>) {
    // check if data already exists, otherwise fetch it

    try {
      const { config, query, dataPoints } = job.data;

      const queryResults = await this.aaClient.execute(createQuery(query));

      const updates = processResults(config, query, dataPoints, queryResults);

      if (typeof updates === 'function') {
        await updates(this.db);

        return;
      }

      await this.db.collections.customReportsMetrics.bulkWrite(updates);

      return;
    } catch (err) {
      console.error('\nAn error occurred processing child job:');
      console.error('jobId: ', job.id);
      console.error('job state: ', job.getState());
      console.error('parent report id: ', job.data.reportId);
      console.error('AA query: ', job.data.query);
      console.error((<Error>err).stack);

      throw err;
    }
  }

  @OnWorkerEvent('lockRenewalFailed')
  onLockRenewalFailed(jobIds: string[]) {
    console.error('Lock renewal failed for jobs:', jobIds);

    for (const jobId of jobIds) {
      this.worker.cancelJob(jobId, 'Lock renewal failed for job');
    }
  }
}
