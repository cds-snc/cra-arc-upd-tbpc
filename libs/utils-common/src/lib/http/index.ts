import { LoggerService } from '@nestjs/common';
import { load } from 'cheerio';
import chalk from 'chalk';
import {
  type AbortController,
  batchAwait,
  Retry,
  squishTrim,
  Timeout,
  TimingUtility,
} from '../utils-common';
import { RateLimitUtils } from './utils';
import { UnwrapPromise } from '../types';

export type HttpClientOptions = {
  rateLimitDelay?: number;
  batchSize?: number;
  logger?: LoggerService | Console;
  rateLimitStats?: boolean;
  rejectOn404?: boolean;
};

export type HttpClientResponse = {
  url: string;
  title?: string;
  body?: string;
  is404: boolean;
  redirect?: string;
  response?: Response;
  error?: Error;
};

const titleRegex = /<title>[\s\S]+?<\/title>/i;
const canadaDotCaRegex = /\s+(-|&nbsp;|&ndash;)\s+Canada\.ca/i;

export class HttpClient {
  private rateLimitDelay = 15;
  private delayContainer = { delay: this.rateLimitDelay };
  private readonly batchSize: number;
  private readonly logger: LoggerService | Console = console;
  private readonly rejectOn404: boolean;
  private rateLimitStats: boolean;
  private rateLimitUtils = new RateLimitUtils();

  constructor(options: HttpClientOptions = {}) {
    this.delay = options.rateLimitDelay || this.rateLimitDelay;
    this.batchSize = options.batchSize || 100;
    this.logger = options.logger || this.logger;
    this.rateLimitStats = options.rateLimitStats || false;
    this.rejectOn404 = options.rejectOn404 || false;
  }

  private set delay(delay: number) {
    this.rateLimitDelay = delay;
    this.delayContainer.delay = delay;
  }

  setRateLimitStats(value: boolean) {
    this.rateLimitStats = value;
  }

  @Retry(5, 250)
  @Timeout(5000)
  async get(url: string): Promise<HttpClientResponse> {
    if (this.rateLimitStats) {
      this.rateLimitUtils.incrementRequests();
      this.rateLimitUtils.updateStats();
    }

    const rateLimitExceededRegex = /503|Access Denied|read ETIMEDOUT/;
    const notFoundRegex = /404/;

    const protocolRegex = /^https?:\/\//;
    const requestUrl = protocolRegex.test(url) ? url : `https://${url}`;

    try {
      const response = await fetch(requestUrl, {
        keepalive: true,
        headers: {
          'User-Agent': `Node/${process.version}`,
        }
      });

      const responseUrl: string = response.url.replace('https://', '');

      const is404 =
        response.status === 404 ||
        responseUrl === 'www.canada.ca/errors/404.html';

      const isRedirect = response.redirected && !is404;

      if (is404 && this.rejectOn404) {
        return Promise.reject(new Error(`404: ${url}`));
      }

      const body = await response.text();

      const rawTitle = (titleRegex.exec(body) || [''])[0].replace(
        canadaDotCaRegex,
        '',
      );

      const title = squishTrim(load(rawTitle)('title').text());

      if (title === 'Access Denied') {
        // there's a warning about a locally caught error,
        // but we need to throw an error for the retry decorator to work
        throw new Error('Access Denied');
      }

      const redirect = isRedirect ? { redirect: responseUrl } : {};

      return {
        url: url.replace('https://', ''),
        body,
        title,
        ...redirect,
        is404,
      };
    } catch (e) {
      this.logger.error(`Error fetching page data for ${url}:`);
      this.logger.error(e);

      if (e instanceof Error) {
        if (rateLimitExceededRegex.test(e.message)) {
          this.logger.warn('Rate limit exceeded. Request stats:');

          const utilsStats = this.rateLimitStats
            ? this.rateLimitUtils.getStats()
            : {};

          const otherStats = {
            delay: this.delayContainer.delay,
            batchSize: this.batchSize,
          };

          this.logger.warn(
            JSON.stringify({ ...utilsStats, ...otherStats }, null, 2),
          );

          this.logger.warn(
            `Resetting stats and increasing delay to ${
              this.delayContainer.delay + 10
            }ms...`,
          );

          this.rateLimitStats && this.rateLimitUtils.reset();

          this.delay = this.rateLimitDelay + 10;
        }

        if (notFoundRegex.test(e.message)) {
          if (this.rejectOn404) {
            throw e;
          }

          return {
            url,
            is404: true,
          };
        }
      }

      throw e;
    }
  }

  async getAll<T>(
    urls: string[],
    callback: (data: HttpClientResponse) => T = (data) => data as T,
    options?: { logProgress: boolean; abortController?: AbortController },
  ) {
    const logProgress = options?.logProgress ?? false;
    const abortController = options?.abortController;

    const progressTimer = new TimingUtility(urls.length);

    if (this.rateLimitStats && !this.rateLimitUtils.startTime) {
      this.rateLimitUtils.startTimer();
    }

    const batchFunc = async (url: string) =>
      this.get(url)
        .then(async (result) => {
          try {
            return await callback(result);
          } catch (err) {
            this.logger.error(`Error in callback for ${url}:`);
            this.logger.error((err as Error).stack);

            return;
          } finally {
            if (logProgress) {
              progressTimer.logIteration();
            }
          }
        })
        .catch((err) => {
          this.logger.error(`Error fetching ${url}:`);
          this.logger.error((err as Error).stack);

          return;
        });

    return await batchAwait(
      urls,
      batchFunc,
      this.batchSize,
      this.delayContainer,
      abortController,
    );
  }
}

export const withRetry = <
  T extends <U>(
    ...args: Parameters<T>
  ) => Promise<UnwrapPromise<ReturnType<T>>>,
>(
  fn: T,
  retries: number,
  delay: number,
) => {
  return <U>(...args: Parameters<T>): Promise<UnwrapPromise<ReturnType<T>>> =>
    new Promise((resolve, reject) => {
      let delayMultiplier = 1;

      const attempt = (retries: number, delay: number) => {
        fn<U>(...args).then(
          (result) => {
            resolve(result);
          },
          (err) => {
            console.error(
              chalk.red(
                `Error below occurred in ${fn.name}, retrying (${
                  retries - 1
                } attempts left)`,
              ),
            );
            console.error(chalk.red(err.message));

            if (retries > 0) {
              delayMultiplier++;

              setTimeout(() => {
                attempt(retries - 1, delay);
              }, delay * delayMultiplier);
            } else {
              console.error(
                chalk.red(`All retry attempts for ${fn.name} failed:`),
              );
              console.error(chalk.red(err.stack));

              reject(err);
            }
          },
        );
      };

      attempt(retries, delay);
    });
};
