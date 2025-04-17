// Utilities for timeouts, retries, and request throttling, etc.

import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import chalk from 'chalk';
import type { DateRange } from '@dua-upd/types-common';

dayjs.extend(utc);

export const withTimeout = <T>(
  fn: () => Promise<T>,
  timeout: number,
): (() => Promise<T>) => {
  return () =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Function ${fn.name} timed out`));
      }, timeout);

      fn().then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
};

export const withRetry = <
  T extends <U>(...args: Parameters<T>) => Promise<ReturnType<T>>,
>(
  fn: T,
  retries: number,
  delay: number,
) => {
  return <U>(...args: Parameters<T>): Promise<ReturnType<T>> =>
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

export const withExponentialBackoff = <
  T extends <U>(...args: Parameters<T>) => Promise<ReturnType<T>>,
>(
  fn: T,
  retries = 5,
  baseDelay = 1000,
) => {
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      const attempt = async (retriesLeft: number, attemptNum: number) => {
        try {
          const result = await fn(...args);
          return resolve(result);
        } catch (err) {
          const isQuotaError =
            err?.message?.includes('quota exceeded') ||
            err?.errors?.some((e) => e.message?.includes('quota exceeded'));

          if (!isQuotaError) {
            console.error(
              chalk.red(`Non-retryable error in ${fn.name}:`, err.message),
            );
            console.error(chalk.red(err.stack));
            return reject(err);
          }

          if (retriesLeft <= 0) {
            console.error(
              chalk.red(
                `All retry attempts for ${fn.name} failed.`,
                err.message,
              ),
            );
            console.error(chalk.red(err.stack));
            return reject(err);
          }

          const delay = baseDelay * Math.pow(2, attemptNum);
          const jitter = Math.floor(Math.random() * 300);
          const totalDelay = delay + jitter;

          console.warn(
            `Quota exceeded in ${fn.name}, retrying in ${totalDelay}ms... (${retriesLeft - 1} retries left)`,
          );

          setTimeout(() => {
            attempt(retriesLeft - 1, attemptNum + 1);
          }, totalDelay);
        }
      };

      attempt(retries, 0);
    });
  };
};

// For GSC or AA page queries, because they're only done on individual dates
/**
 *
 * @param dateRange DateRange object specifying the start and end dates
 * @param format The format of the date string, or false to return as Date objects
 * @param inclusive Whether or not to include the end date in the range (AA is exclusive)
 */
export function singleDatesFromDateRange(
  dateRange: DateRange<string>,
  format: string | false = 'YYYY-MM-DD',
  inclusive = false,
): Date[] | string[] {
  const dates: Dayjs[] = [];

  let currentDate = dayjs.utc(dateRange.start);

  const endDate = inclusive
    ? dayjs.utc(dateRange.end).add(1, 'day')
    : dayjs.utc(dateRange.end);

  while (!currentDate.isSame(endDate, 'day')) {
    dates.push(currentDate);
    currentDate = currentDate.add(1, 'day');
  }

  return format
    ? dates.map((date) => date.format(format))
    : dates.map((date) => date.toDate());
}
