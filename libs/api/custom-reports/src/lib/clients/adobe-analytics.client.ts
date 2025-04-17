import type { AnalyticsCoreAPI } from '@adobe/aio-lib-analytics';
import {
  days,
  wait,
  withErrorCallback,
  withMutex,
  withRetry,
} from '@dua-upd/utils-common';
import type {
  AuthParams,
  AAMaybeResponse,
  AAResponseBody,
  AdobeAnalyticsReportQuery,
} from '@dua-upd/node-utils';
import { defaultAuthParams, getAAClient } from '@dua-upd/node-utils';

class AAClient {
  private client!: AnalyticsCoreAPI;
  private authParams!: AuthParams;
  private tokenExpiry = 0;

  constructor(authParams?: AuthParams) {
    if (authParams) {
      this.authParams = authParams;
    }
  }

  async execute(query: AdobeAnalyticsReportQuery) {
    await this.ensureClient();

    const resultsPromise: Promise<AAMaybeResponse> =
      this.client.getReport(query);

    return resultsPromise.then((results) => {
      if ('errorCode' in results.body) {
        throw new Error(
          `Error response received from AA API call:
          Error code ${results.body.errorCode}: ${results.body.errorDescription}`,
        );
      }

      return results.body as AAResponseBody;
    });
  }

  async initClient(authParams?: AuthParams) {
    this.authParams = authParams || this.authParams || defaultAuthParams();

    if (!this.authParams.expiryDateTime) {
      this.authParams.expiryDateTime = Math.floor(
        (Date.now() + days(1)) / 1000,
      );

      this.tokenExpiry = this.authParams.expiryDateTime;
    }

    const getAAClientWithRetry = withRetry(getAAClient, 3, 1000);

    this.client = await getAAClientWithRetry(this.authParams);

    return this.client;
  }

  private async ensureClient() {
    if (!this.client || this.tokenIsExpired()) {
      await this.initClient(
        this.authParams && {
          ...this.authParams,
          expiryDateTime: undefined,
        },
      );
    }
  }

  private tokenIsExpired() {
    return this.tokenExpiry < Math.floor(Date.now() / 1000);
  }
}

const createAAClient = (authParams?: AuthParams) =>
  withMutex(new AAClient(authParams), { unlockDelay: 510 });

// use pool to invisibly intersperse requests between clients
// can make this generic to any client type and add settings like concurrency, rate limiting, etc.
export class AdobeAnalyticsClient {
  private clientPool: AAClient[] = [];
  private pendingPauses: Promise<void>[] = [];
  private pausePromise: Promise<void> | null = null;

  constructor(
    authParams: AuthParams[] = [],
    private errorPauseDuration = 500,
  ) {
    if (authParams.length === 0) {
      this.clientPool = [createAAClient()];

      return;
    }

    const boundPause = this.pausePool.bind(this);

    this.clientPool = authParams.map((params) =>
      withErrorCallback(createAAClient(params), () => {
        console.error(
          `Error in AA client - pausing pool for ${this.errorPauseDuration}ms`,
        );
        boundPause();
      }),
    );
  }

  async init() {
    await Promise.all(this.clientPool.map((client) => client.initClient()));
  }

  pausePool() {
    if (this.pausePromise) {
      console.log('AA client pool already paused - resetting pause promise');
    }

    this.pausePromise && this.pendingPauses.push(this.pausePromise);

    this.pendingPauses.push(wait(this.errorPauseDuration));

    this.pausePromise = Promise.all([
      ...this.pendingPauses.splice(0, this.pendingPauses.length),
    ]).then(() => {
      // make sure no new pauses were added while waiting
      // if so, we don't want to set pausePromise to null
      if (this.pendingPauses.length === 0) {
        console.log('unpausing AA client pool');
        this.pausePromise = null;
      }
    });
  }

  async execute(query: AdobeAnalyticsReportQuery) {
    const client = this.clientPool.shift();

    if (!client) {
      throw new Error('No clients available');
    }

    // use while loop, because the pause may be reset while waiting
    while (this.pausePromise) {
      console.log('AA client pool paused - waiting to resume');
      await this.pausePromise;
    }

    const results = client.execute(query);

    this.clientPool.push(client);

    return results;
  }
}
