import {
  InjectQueue,
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { filter, startWith, Subject, map, combineLatest } from 'rxjs';

export type ReportJobStatus = {
  jobId: string;
  status: 'pending' | 'complete' | 'error';
  totalChildJobs?: number;
  completedChildJobs?: number;
  totalPendingServerJobs?: number;
  data?: Record<string, unknown>[];
  error?: Error;
};

export type ChildJobStatus = {
  jobId: string;
  status: 'pending' | 'complete' | 'error';
  error?: Error;
  totalPendingServerJobs?: number;
};

@QueueEventsListener('fetchAndProcessReportData')
export class ChildQueueEvents extends QueueEventsHost {
  private globalChildJobEvents$ = new Subject<ChildJobStatus>();

  constructor(
    @InjectQueue('fetchAndProcessReportData')
    private childJobsQueue: Queue,
  ) {
    super();
  }

  async getTotalActiveServerJobs(): Promise<number> {
    const { active, waiting } = await this.childJobsQueue.getJobCounts(
      'active',
      'waiting',
    );

    return active + waiting;
  }

  getReportChildrenObservable(childJobIds: string[]) {
    const childEvents$ = this.globalChildJobEvents$.pipe(
      filter((event) => childJobIds.includes(event.jobId)),
      startWith({
        jobId: '',
        status: 'pending',
        totalPendingServerJobs: 0,
      } satisfies ChildJobStatus),
    );
    const totalPendingServerJobs$ = this.globalChildJobEvents$.pipe(
      map(({ totalPendingServerJobs }) => ({ totalPendingServerJobs })),
      startWith({ totalPendingServerJobs: 0 }),
    );

    const combined$ = combineLatest([
      childEvents$,
      totalPendingServerJobs$,
    ]).pipe(
      map(([childEvent, { totalPendingServerJobs }]) => ({
        ...childEvent,
        totalPendingServerJobs,
      })),
    );

    return combined$;
  }

  @OnQueueEvent('progress')
  onProgress({ jobId, data }: { jobId: string; data: number | object }) {
    console.log('progress: ', jobId, data);
  }

  @OnQueueEvent('error')
  onError(error: Error) {
    console.error(error.stack);
  }

  @OnQueueEvent('completed')
  async onCompleted({ jobId }: { jobId: string }) {
    this.globalChildJobEvents$.next({
      jobId,
      status: 'complete',
      totalPendingServerJobs: await this.getTotalActiveServerJobs(),
    });
  }

  @OnQueueEvent('active')
  async onActive({ jobId }: { jobId: string }) {
    this.globalChildJobEvents$.next({
      jobId,
      status: 'pending',
      totalPendingServerJobs: await this.getTotalActiveServerJobs(),
    });
  }

  @OnQueueEvent('failed')
  onFailed({ jobId, failedReason }: { jobId: string; failedReason: string }) {
    console.error(jobId, failedReason);

    this.globalChildJobEvents$.next({
      jobId,
      status: 'error',
      error: new Error(failedReason),
    });
  }
}

@QueueEventsListener('prepareReportData')
export class ReportsQueueEvents extends QueueEventsHost {
  private globalReportEvents$ = new Subject<ReportJobStatus>();

  constructor(
    @InjectQueue('prepareReportData')
    private queue: Queue,
    @InjectQueue('fetchAndProcessReportData')
    private childQueue: Queue,
    private childQueueEvents: ChildQueueEvents,
  ) {
    super();
  }

  getReportObservable(reportId: string) {
    return this.globalReportEvents$.pipe(
      filter((event) => reportId === event.jobId),
      startWith({
        jobId: reportId,
        status: 'pending',
        totalChildJobs: 0,
        completedChildJobs: 0,
        totalPendingServerJobs: 0,
      } satisfies ReportJobStatus),
    );
  }

  @OnQueueEvent('error')
  onError(error: Error) {
    console.error(error.stack);
  }

  @OnQueueEvent('completed')
  async onCompleted({
    jobId,
    returnvalue,
  }: {
    jobId: string;
    returnvalue: Record<string, unknown>[];
  }) {
    console.log(`Report job ${jobId} complete!`);

    this.globalReportEvents$.next({
      jobId,
      status: 'complete',
      data: returnvalue,
    });

    await this.queue.clean(60 * 1000, 100);
    await this.childQueue.clean(0, 300);
  }

  @OnQueueEvent('failed')
  onFailed({
    jobId,
    failedReason,
  }: {
    jobId: string;
    failedReason: string;
    prev?: string;
  }) {
    console.error('Job failed:');
    console.error(jobId, failedReason);

    this.globalReportEvents$.next({
      jobId,
      status: 'error',
      error: new Error(failedReason),
    });
  }
}
