import { TasksHomeAggregatedData } from '@dua-upd/types-common';
import chalk from 'chalk';

// Utility function for to help with rate-limiting within async functions
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Removes double-spaces and trims the string
export function squishTrim<T extends string>(str?: T) {
  return (str?.replaceAll(/\s+/g, ' ').trim() as T) || '';
}

// Because including 0 is important 😉
export function isNullish(val: unknown): val is null | undefined {
  return val === null || val === undefined;
}

// Checks if an array has duplicate values (not including deep comparison)
export const hasDuplicates = <T>(array: T[]) =>
  array.length !== 0 && new Set(array).size !== array.length;

// Used for measuring function execution time
//  -credit: https://leefreeman.xyz/2020/05/08/typescript-decorators/
export function LogTiming(message = '') {
  return function (
    _target: object,
    name: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    descriptor.value = async function () {
      const startTime = new Date(Date.now());
      await method.apply(this);
      const endTime = new Date(Date.now());
      console.log(
        `${message || name} took ${
          endTime.getTime() - startTime.getTime()
        }ms to complete.`,
      );
    };
  };
}

export const AsyncLogTiming = <T extends (...args: unknown[]) => ReturnType<T>>(
  _target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => {
  const originalMethod: T = descriptor.value;

  descriptor.value = async function (...args: Parameters<T>) {
    const start = Date.now();
    const result = await originalMethod.apply(this, args);
    const finish = Date.now();
    console.log(
      `${propertyKey} Execution time: ${
        Math.round((finish - start) / 10) / 100
      } seconds`,
    );
    return result;
  };

  return descriptor;
};

// Decorator for setting an Input field as required
export function Required(target: object, propertyKey: string) {
  Object.defineProperty(target, propertyKey, {
    get() {
      throw new Error(`Attribute ${propertyKey} is required`);
    },
    set(value) {
      Object.defineProperty(target, propertyKey, {
        value,
        writable: true,
        configurable: true,
      });
    },
    configurable: true,
  });
}

/**
 * Converts an array of objects into a "dictionary" or lookup table, using the value of the specified property as the key
 *
 * Helps with performance when searching nested properties of large arrays of objects
 *
 * @param array The array to convert
 * @param keyProp The property to use as keys
 * @param allowDuplicateKeys Will throw an error if a duplicate key is found by default
 *
 * @example
 * const arrayOfObjects = [{ prop1: 'a string', ... }];
 * // Say I need to check a bunch of strings against my array
 * const aBunchOfStrings ['Wow', 'look', *'a string'*, 'and another'];
 *
 * // I could use Array.find() and do a full search for every string, or...
 *
 * const objectDictionary = arrayToDictionary(arrayOfObjects, 'prop1'); // { 'a string': { ... } }
 *
 * // oh boy i hope i find an object with 'a string' as prop1
 * for (const potentialMatch of aBunchOfStrings) {
 *   const match = objectDictionary[potentialMatch];
 *
 *   if (match) {
 *     console.log(match);
 *     // {
 *     //   prop1: 'a string',
 *     //   ...
 *     // }
 *   }
 * }
 *
 */
export function arrayToDictionary<T extends object>(
  array: T[],
  keyProp: keyof T,
  allowDuplicateKeys = false,
) {
  if (!array.length) return {};

  const dictionary: Record<string, T> = {};

  for (const obj of array) {
    const key = `${obj[keyProp]}`;

    if (!key) {
      throw Error(
        'Could not convert array to dictionary: the value of the key property is invalid or undefined.\r\n' +
          'Object where error occurred:\r\n\r\n' +
          JSON.stringify(obj, null, 2),
      );
    }

    if (dictionary[key]) {
      if (!allowDuplicateKeys) {
        throw Error(
          'Could not convert array to dictionary: received duplicate key: ' +
            key,
        );
      }

      console.warn(
        'Duplicate key found when converting array to dictionary: ' + key,
      );
      console.warn(JSON.stringify(obj, null, 2));
    }

    dictionary[key] = obj;
  }

  return dictionary;
}

export function arrayToDictionaryFlat<T extends object>(
  array: T[],
  keyProp: keyof T,
  allowDuplicateKeys = false,
) {
  if (!array.length) return {};

  if (!Array.isArray(array[0][keyProp])) {
    throw Error('Key property should be an array of strings to be flattened');
  }

  const dictionary: Record<string, T> = {};

  for (const obj of array) {
    const keys = obj[keyProp] as string[];

    if (!keys) {
      throw Error(
        'Could not convert array to dictionary: the value of the key property is invalid or undefined.\r\n' +
          'Object where error occurred:\r\n\r\n' +
          JSON.stringify(obj, null, 2),
      );
    }

    for (const key of keys) {
      if (!allowDuplicateKeys && dictionary[key]) {
        throw Error(
          'Could not convert array to dictionary: received duplicate key: ' +
            key,
        );
      }

      dictionary[key] = obj;
    }
  }

  return dictionary;
}

/**
 * Another version of arrayToDictionary, for cases where the keys are not unique.
 * The keys can be used to look up an array of objects corresponding with that key.
 *
 * @param array The array to convert
 * @param keyProp The property to use as keys
 * @param flat Whether the key property is an array of strings to be flattened
 **/
export function arrayToDictionaryMultiref<T extends object>(
  array: T[],
  keyProp: keyof T,
  flat = false,
) {
  if (!array.length) return {};

  const dictionary: Record<string, T[]> = {};

  const error = Error(
    'Could not convert array to dictionary: the value of the key property is invalid or undefined.\r\n' +
      'Object where error occurred:\r\n\r\n' +
      JSON.stringify(array[0], null, 2),
  );

  if (flat) {
    for (const obj of array) {
      const keys = obj[keyProp] as string[];

      if (!keys) {
        throw error;
      }

      for (const key of keys) {
        if (!dictionary[key]) {
          dictionary[key] = [];
        }

        dictionary[key].push(obj);
      }
    }

    return dictionary;
  }

  for (const obj of array) {
    const key = `${obj[keyProp]}`;

    if (!key) {
      throw error;
    }

    if (!dictionary[key]) {
      dictionary[key] = [];
    }

    dictionary[key].push(obj);
  }

  return dictionary;
}

// For cloning class instances, objects, etc., including current state
export const clone = <T extends object>(obj: T): T =>
  Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);

/**
 * Because I was getting tired of re-typing 'console.log(JSON.stringify(anything, null, 2))' over and over
 * @param anything - The value to log
 * @param logger - Optional custom logger (though honestly why not just add this to the custom logger?)
 */
export function logJson(anything: unknown, logger = console.log) {
  logger(JSON.stringify(anything, null, 2));
}

// For logging JSON
export function prettyJson(obj: unknown) {
  return JSON.stringify(obj, null, 2);
}

/**
 * It takes an array of objects from AA, and returns an array of arrays, where each array is a group of objects
 * @param {{ data: number[]; value: string }[]} arr - The array of objects that you want to seperate.
 * @returns An array of arrays of objects.
 */
export function seperateArray(arr: { data: number[]; value: string }[]) {
  const newArrays: { data: number; value: string }[][] = [];

  for (let i = 0; i < arr.length; i++) {
    const current_row = arr[i];
    for (let j = 0; j < current_row.data.length; j++) {
      const current_data = current_row.data[j];

      if (newArrays[j] === undefined) {
        newArrays[j] = [];
      }

      if (current_data === 0) {
        continue;
      }

      newArrays[j].push({
        data: current_data,
        value: current_row.value,
      });
    }
  }

  return newArrays;
}

/**
 * It sorts an array of arrays of objects by the data property in descending order
 * @param {{ data: number; value: string }[][]} arr - The array to be sorted.
 * @returns the sorted array.
 */
export function sortArrayDesc(arr: { data: number; value: string }[][]) {
  arr.forEach((e) => {
    e.sort((a, b) => {
      return b.data - a.data;
    });
  });

  return arr;
}

export const globalColours: string[] = [
  '#2E5EA7',
  '#64B5F6',
  '#26A69A',
  '#FBC02D',
  '#1DE9B6',
  '#F57F17',
  '#602E9C',
  '#2196F3',
  '#DE4CAE',
  '#C3680A',
  '#C5C5FF',
  '#1A8361',
];

/**
 * Determines the optimal text colour (black or white) for readability
 * based on the background colour’s luminance.
 * @param {string} backgroundColour - The hex colour code to evaluate.
 * @returns {string} The ideal contrast colour (`#333` for dark text or `#FFF` for light text).
 */
export function getOptimalTextcolour(backgroundColour: string): string {
  const hex = backgroundColour.replace('#', '');

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Calculate relative luminance (WCAG formula)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  return luminance > 0.5 ? '#333' : '#FFF';
}

export class AbortController {
  private controller: globalThis.AbortController;
  public signal: globalThis.AbortSignal;
  constructor() {
    this.controller = new globalThis.AbortController();
    this.signal = this.controller.signal;
  }

  abort() {
    this.controller.abort();
  }
}

/**
 * Performs async processing in batches of a given size, with
 * an optional delay between calls to handle rate-limiting.
 * @param paramsArray - The array of parameters which will each individually be passed to the function.
 * @param fn - The async function to be called on each item.
 * @param batchSize - The maximum number of concurrent calls that can be pending.
 * @param delay - Can be a number for constant delay or an object for dynamic delay.
 */
export async function batchAwait<T, U>(
  paramsArray: T[],
  fn: (param: T) => Promise<U>,
  batchSize: number,
  delay: number | { delay: number } = 0,
  abortController?: AbortController,
): Promise<U[]> {
  const promises: Promise<U>[] = [];

  for (const params of paramsArray) {
    const promise = fn(params);
    promises.push(promise);

    const currentDelay = typeof delay === 'number' ? delay : delay.delay;

    if (promises.length !== 0 && promises.length % batchSize === 0) {
      await Promise.all(
        currentDelay ? [...promises, wait(currentDelay)] : promises,
      );
      continue;
    }

    if (abortController?.signal.aborted) {
      break;
    }

    currentDelay && (await wait(currentDelay));
  }

  return Promise.all(promises);
}

type InsertFunc<T> = (ops: T[]) => Promise<void>;

/**
 * Creates a queue that will perform queued updates when it reaches maxQueueSize
 * @param maxQueueSize
 * @param insertFunc
 */
export const createUpdateQueue = <T>(
  maxQueueSize: number,
  insertFunc: InsertFunc<T>,
) => {
  const queue: T[] = [];

  const flush = async () => {
    const ops = queue.splice(0, queue.length);

    try {
      if (ops.length > 0) {
        await insertFunc(ops);
      }
    } catch (err) {
      console.error('Error occurred in createUpdateQueue flush:', err);
      logJson(ops);
    }
  };

  const add = async (ops: T) => {
    if (queue.length >= maxQueueSize) {
      await flush();
    }

    queue.push(ops);
  };

  return {
    add,
    flush,
  };
};

/**
 * Maps over chunks of an array rather than individual items
 * @param array Array to map over
 * @param mapFunc Map function
 * @param chunkSize Size of chunks
 */
export function chunkMap<T, ReturnT>(
  array: T[],
  mapFunc: (val: T[]) => ReturnT,
  chunkSize: number,
): ReturnT[] {
  array = array.slice();
  const chunks = [];

  while (array.length) {
    chunks.push(mapFunc(array.splice(0, chunkSize)));
  }

  return chunks;
}

/**
 * Utility class for timing and logging iterations.
 *
 * @example
 * ```typescript
 * const anArray = ['an', 'array'];
 * const timingUtility = new TimingUtility(anArray.length);
 *
 * for (const item of anArray) {
 *   // Perform some operation
 *   timingUtility.logIteration(`Iteration ${i + 1} completed`);
 * }
 * ```
 */
export class TimingUtility {
  private previousIterationEndTime = Date.now();
  private iterationDurations: number[] = [];
  private iterationCount = 0;
  private averageDuration = 1500;

  /**
   * Creates an instance of TimingUtility.
   *
   * @param totalIterations - The total number of iterations to be performed.
   * @param logInterval - The interval at which to output a log message. Defaults to 100.
   */
  constructor(
    private totalIterations: number,
    private logInterval = 100,
  ) {}

  /**
   * Calculates the average duration of the iterations.
   */
  private calculateAverage(): void {
    const sum = this.iterationDurations.reduce(
      (total, duration) => total + duration,
      0,
    );
    this.averageDuration = sum / this.iterationDurations.length;
  }

  /**
   * Formats the remaining time in a human-readable string.
   *
   * @param milliseconds - The remaining time in milliseconds.
   * @returns The formatted remaining time as a string.
   */
  private formatTimeRemaining(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = (seconds / 60).toFixed(2);
    return seconds > 60
      ? `${minutes} minute${seconds < 120 ? '' : 's'}`
      : `${seconds} second${seconds === 1 ? '' : 's'}`;
  }

  /**
   * Formats the iteration count with leading zeros.
   *
   * @returns The formatted iteration count as a string.
   */
  private formatIterationCount() {
    const lessThan10 = this.iterationCount < 10 ? '0' : '';
    const lessThan100 = this.iterationCount < 100 ? '0' : '';
    return `${lessThan10}${lessThan100}${this.iterationCount}`;
  }

  /**
   * Logs the duration of the current iteration and other relevant information.
   *
   * @param customMessage - An optional custom message to include in the log.
   */
  public logIteration(customMessage?: string): void {
    const iterationStartTime = Date.now();

    const iterationDuration =
      iterationStartTime - this.previousIterationEndTime;

    this.iterationDurations.push(iterationDuration);

    this.iterationCount++;

    this.calculateAverage();

    const timeRemaining = this.formatTimeRemaining(
      (this.totalIterations - this.iterationCount) * this.averageDuration,
    );

    const message =
      `${chalk.green('✔')}  ${chalk.dim(new Date().toLocaleTimeString())} | ` +
      `${chalk.bold(this.formatIterationCount())}: ${chalk.yellow(
        `${iterationDuration}ms`,
      )} | ` +
      `${chalk.blue(`Average: ${this.averageDuration.toFixed(2)}ms`)} | ` +
      `${chalk.magenta(`Time remaining: ${timeRemaining}`)} | ${
        customMessage || ''
      }\r`;

    if (
      (this.logInterval && this.iterationCount % this.logInterval === 0) ||
      iterationDuration >= 500 ||
      (iterationDuration <= 200 && this.iterationCount % 100 === 0) ||
      (iterationDuration > 200 && this.iterationCount % 8 === 0)
    ) {
      console.log(message);
    }

    this.previousIterationEndTime = Date.now();
  }
}

/**
 * Maps an array using the provided mapping function and logs the estimated time of arrival (ETA) at specified intervals.
 *
 * @template T - The type of elements in the input array.
 * @template U - The type of elements in the output array.
 * @param array - The array to be mapped.
 * @param mapFunc - The mapping function to apply to each element in the array.
 * @param logInterval - The interval at which to log the ETA. Defaults to 100.
 * @returns  The array resulting from applying the mapping function to each element in the input array.
 */
export function mapWithETALogging<T, U>(
  array: T[],
  mapFunc: (val: T) => U,
  logInterval = 100,
): U[] {
  const timingUtility = new TimingUtility(array.length, logInterval);

  const results: U[] = [];

  for (const [i, val] of array.entries()) {
    results.push(mapFunc(val));

    timingUtility.logIteration();
  }

  return results;
}

/**
 * Asynchronously maps an array using a provided mapping function and logs the estimated time of arrival (ETA) at specified intervals.
 *
 * @template T - The type of elements in the input array.
 * @template U - The type of elements in the resulting array.
 * @param array - The array to be mapped.
 * @param mapFunc - The asynchronous mapping function to apply to each element.
 * @param logInterval - The interval at which to log the ETA. Defaults to 100.
 * @returns A promise that resolves to an array of mapped values.
 */
export async function mapWithETALoggingAsync<T, U>(
  array: T[],
  mapFunc: (val: T) => Promise<U>,
  logInterval = 100,
) {
  const timingUtility = new TimingUtility(array.length, logInterval);

  const results: U[] = [];

  for (const val of array) {
    results.push(await mapFunc(val));

    timingUtility.logIteration();
  }

  return results;
}

/*
 * Decorator for retrying failed http requests
 */
export function Retry(retries: number, delay: number) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      ...args: Parameters<typeof originalMethod>[]
    ) {
      let delayMultiplier = 1;

      const attempt = async (
        retries: number,
        delay: number,
      ): Promise<ReturnType<typeof originalMethod>> => {
        try {
          return await originalMethod.apply(this, args);
        } catch (err) {
          console.error(
            chalk.red(
              `Error occurred in ${originalMethod.name}, retrying (${retries} attempts left)` +
                `\n${err}`,
            ),
          );

          if (retries > 0) {
            delayMultiplier++;

            await wait(delay * delayMultiplier);

            return await attempt(retries - 1, delay * delayMultiplier);
          } else {
            console.error(
              chalk.red(
                `All retry attempts for ${originalMethod.name} failed:`,
              ),
            );
            console.error(chalk.red(err));

            throw err;
          }
        }
      };

      return attempt(retries, delay);
    };

    return descriptor;
  };
}

/*
 * Decorator for setting a timeout and throwing an error if it is exceeded
 */
export function Timeout(milliseconds: number) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      ...args: Parameters<typeof originalMethod>[]
    ): Promise<ReturnType<typeof originalMethod>> {
      const timeout = setTimeout(() => {
        throw new Error(
          `Timeout of ${milliseconds}ms exceeded in ${originalMethod.name}`,
        );
      }, milliseconds);

      try {
        return originalMethod.apply(this, args);
      } finally {
        clearTimeout(timeout);
      }
    };

    return descriptor;
  };
}

/*
 * Takes an array of strings, normalizes whitespace, and returns a deduplicated array
 */
export const collapseStrings = (strings: string[]) => [
  ...new Set(strings.map((s) => s.replace(/\s+/g, ' ').trim())),
];

/**
 * A simple mutex implementation for controlling access to shared resources
 */
export class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async lock() {
    if (this.locked) {
      return new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.locked = true;
  }

  unlock() {
    const resolve = this.queue.shift();

    if (resolve) {
      resolve();

      return;
    }

    this.locked = false;
  }
}

export type MutexOptions<T> = {
  unlockDelay?: number;
  methodList?: (keyof T)[];
};

/**
 * Wraps an object or class instance with a mutex to control access to shared resources
 *
 * @param obj The object or class instance to wrap with a mutex
 * @param options.unlockDelay The delay in milliseconds to wait before unlocking the mutex
 * @param options.methodList The list of methods that require mutex locking
 * @returns
 */
export function withMutex<T extends object>(
  obj: T,
  options?: MutexOptions<T>,
): T {
  const mutex = new Mutex();
  const unlockDelay = options?.unlockDelay || 0;
  const methodList = options?.methodList;

  return new Proxy(obj, {
    get(target, propKey, receiver) {
      const origMethod = Reflect.get(target, propKey, receiver);

      if (
        typeof origMethod === 'function' &&
        (!methodList || methodList.includes(propKey as keyof T))
      ) {
        return async (...args: unknown[]) => {
          await mutex.lock();

          try {
            return origMethod.apply(target, args);
          } finally {
            await wait(unlockDelay);
            mutex.unlock();
          }
        };
      }
      return origMethod;
    },
  });
}

export function withErrorCallback<
  T extends object,
  Fn extends (err: unknown) => any,
>(
  obj: T,
  callback: Fn,
  options?: {
    methodList?: (keyof T)[];
  },
): T {
  const methodList = options?.methodList;

  return new Proxy(obj, {
    get(target, propKey, receiver) {
      const origMethod = Reflect.get(target, propKey, receiver);

      if (
        typeof origMethod === 'function' &&
        (!methodList || methodList.includes(propKey as keyof T))
      ) {
        return async (...args: unknown[]) => {
          try {
            return await origMethod.apply(target, args);
          } catch (err) {
            await callback(err);
            throw err;
          }
        };
      }
      return origMethod;
    },
  });
}

/**
 * Helper function to work around DocumentDB's lack of support for the $pow operator
 * @param mongoExpression - The expression to be raised to the power of exponent
 * @param exponent - The exponent to raise the expression to
 */
export const $pow = (
  mongoExpression: string | Record<string, unknown>,
  exponent: number,
) => ({ $multiply: Array(exponent).fill(mongoExpression) });

/**
 * Helper function to work around DocumentDB's lack of support for the $trunc operator
 * @param mongoExpression - The expression to be truncated
 * @param precision - The number of decimal places to truncate to
 */
export const $trunc = (
  mongoExpression: string | Record<string, unknown>,
  precision: number,
) => ({
  $divide: [
    { $floor: { $multiply: [mongoExpression, Math.pow(10, precision)] } },
    Math.pow(10, precision),
  ],
});

type Metric = 'visits' | 'calls' | 'dyf_total' | 'survey';
const METRIC_KEYS: Metric[] = ['visits', 'calls', 'dyf_total', 'survey'];

interface DistributionStats {
  min: number;
  max: number;
  p5: number;
  p95: number;
}
type StatsByMetric = {
  visits: DistributionStats;
  calls: DistributionStats;
  dyf_total: DistributionStats;
  survey: DistributionStats;
};
type MetricWeights = {
  visits: number;
  calls: number;
  dyf_total: number;
  survey: number;
};

export const METRIC_WEIGHTS: MetricWeights = {
  visits: 50,
  calls: 30,
  dyf_total: 10,
  survey: 10,
};

const calculatePercentile = (
  sortedAsc: number[],
  percentile: number,
): number => {
  const size = sortedAsc.length;
  const rank = 1 + (size - 1) * percentile;
  const lowerRank = Math.floor(rank);
  const fraction = rank - lowerRank;
  const lowerValue = sortedAsc[lowerRank - 1]!;
  const upperValue = sortedAsc[lowerRank]!;

  return lowerValue + fraction * (upperValue - lowerValue);
};

const computeDistributionStats = (arr: number[]): DistributionStats => {
  const data = arr.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (data.length === 0) return { min: NaN, max: NaN, p5: NaN, p95: NaN };
  let min = data[0]!,
    max = data[0]!;
  for (let i = 1; i < data.length; i++) {
    const v = data[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const sorted = [...data].sort((a, b) => a - b);
  const p5 = calculatePercentile(sorted, 0.05);
  const p95 = calculatePercentile(sorted, 0.95);
  return { min, max, p5, p95 };
};

const normalizeWithinPercentileRange = (
  rawValue: unknown,
  p5th: unknown,
  p95th: unknown,
): number | undefined => {
  const value = Number(rawValue),
    low = Number(p5th),
    high = Number(p95th);
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(low) ||
    !Number.isFinite(high)
  )
    return undefined;
  const span = high - low;
  if (!(span > 0)) return undefined;
  const clamped = Math.max(Math.min(value, high), low);
  return (clamped - low) / span;
};

const tailBonusAboveP95 = (
  rawValue: unknown,
  p95th: unknown,
  rawMax: unknown,
  tailCap: number,
): number => {
  const value = Number(rawValue),
    p95 = Number(p95th),
    maxVal = Number(rawMax);
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(p95) ||
    !Number.isFinite(maxVal)
  )
    return 0;
  if (!(value > p95) || !(maxVal > p95) || !(tailCap > 0)) return 0;
  const tailSpan = maxVal - p95;
  const proportion = (value - p95) / tailSpan;
  return Math.max(0, Math.min(1, proportion)) * tailCap;
};

export function computeMetricWeightedScore(
  rawValue: unknown,
  p5th: number,
  p95th: number,
  maxVal: number,
  weight: number,
): number | undefined {
  const base = normalizeWithinPercentileRange(rawValue, p5th, p95th);
  if (base === undefined) return undefined;
  const tailCap = 1 / weight;
  const tail = tailBonusAboveP95(rawValue, p95th, maxVal, tailCap);
  return base * (weight - 1) + tail * weight;
}

export async function getGlobalMetricStats(
  tasks: TasksHomeAggregatedData[],
): Promise<StatsByMetric> {
  const metrics = {
    visits: [],
    calls: [],
    dyf_total: [],
    survey: [],
  } as Record<Metric, number[]>;

  for (const t of tasks ?? []) {
    const dyfNo = Number(t['dyf_no']);
    const dyfYes = Number(t['dyf_yes']);

    const dyfTotal =
      (Number.isFinite(dyfNo) ? dyfNo : 0) +
      (Number.isFinite(dyfYes) ? dyfYes : 0);

    if (dyfTotal !== 0) metrics['dyf_total'].push(dyfTotal);

    for (const k of ['visits', 'calls', 'survey'] as const) {
      const n = Number(t[k]);
      if (Number.isFinite(n) && n !== 0) metrics[k].push(n);
    }
  }

  return Object.fromEntries(
    Object.entries(metrics).map(([k, v]) => [k, computeDistributionStats(v)]),
  ) as StatsByMetric;
}
