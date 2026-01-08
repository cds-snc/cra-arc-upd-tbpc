import { Types } from 'mongoose';
import { avg, percentChange, round } from '../math';
import type { IUxTest, SuccessRates } from '@dua-upd/types-common';
import {
  type Dictionary,
  filter,
  flatten,
  groupBy,
  keys,
  map,
  mapObject,
  pipe,
  piped,
  pluck,
  unwind,
} from 'rambdax';
import { arrayToDictionary, isNullish } from '../utils-common';

export type DbEntity = {
  _id: Types.ObjectId;
};

// Taken from https://github.com/sindresorhus/type-fest/blob/main/source/simplify.d.ts
export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

/**
 * Takes two objects and calculates the percent change for each property
 * that is present in both the data and comparisonData objects.
 *
 * @param props The properties to calculate percent change for
 * @param data The data object to add percent change to
 * @param comparisonData The data object to compare against
 * @returns The data object with percent change properties added
 */
export const getSelectedPercentChange = <
  T2 extends Record<string, any>,
  T extends T2,
  const Props extends readonly (keyof T2)[],
  const Suffix extends string = 'PercentChange',
>(
  props: Props extends readonly (string | number)[] ? Props : never,
  data: T,
  comparisonData: T2,
  options: { round?: number; suffix: Suffix } = {
    suffix: 'PercentChange' as Suffix,
  } as const,
) => {
  const suffix: Suffix = (options.suffix || 'PercentChange') as Suffix;

  const percentChangeResults = Object.fromEntries(
    props.map((prop) => {
      const percentChangeProp = `${prop}${suffix}`;

      const value = data[prop];
      const comparisonValue = comparisonData[prop];

      if (!value || !comparisonValue) {
        return [percentChangeProp, null];
      }

      const percentChangeValue = percentChange(value, comparisonValue);

      return [
        percentChangeProp,
        round(percentChangeValue, options?.round || 5),
      ];
    }),
  ) as {
    [Prop in Props[number] as `${string & Prop}${Suffix}`]: number | null;
  };

  return {
    ...data,
    ...percentChangeResults,
  };
};

/**
 * Similar to {@link getSelectedPercentChange} but for arrays of objects
 *
 * Takes two arrays of objects and calculates the percent change for each property
 * that is present in both the data and comparisonData arrays, finding the appropriate
 * comparison element using the specified key.
 *
 * @param props The properties to calculate percent change for
 * @param joinKey The key to join the data and comparisonData arrays on
 * @param data The array of data object to add percent change to
 * @param comparisonData The array of data object to compare against
 * @returns The data object with percent change properties added
 * @example
 * const data = [{ id: 1, value: 10 }, { id: 2, value: 20 }];
 * const comparisonData = [{ id: 1, value: 5 }, { id: 2, value: 10 }];
 * const props = ['value'];
 * const joinKey = 'id';
 * const result = getArraySelectedPercentChange(props, joinKey, data, comparisonData);
 * // result = [{ id: 1, value: 10, valuePercentChange: 100 }, { id: 2, value: 20, valuePercentChange: 100 }]
 */
export const getArraySelectedPercentChange = <
  T2 extends Record<string, any>,
  T extends T2,
  const Props extends readonly (keyof T2)[],
  const Suffix extends string = 'PercentChange',
>(
  props: Props extends readonly (string | number)[] ? Props : never,
  joinKey: keyof T2 & string,
  data: T[] = [],
  comparisonData: T2[] = [],
  options: { round?: number; suffix: Suffix } = {
    suffix: 'PercentChange' as Suffix,
  } as const,
) => {
  const comparisonDict = arrayToDictionary(comparisonData, joinKey);

  return data.map((dataObj) => {
    const comparisonObj = comparisonDict[dataObj[joinKey]];

    if (!comparisonObj) {
      const emptyComparison = Object.fromEntries(
        props.map((prop) => [prop, null]),
      ) as T;

      return getSelectedPercentChange(props, dataObj, emptyComparison, options);
    }

    return getSelectedPercentChange(props, dataObj, comparisonObj, options);
  });
};

/**
 * Takes two objects and calculates the absolute change (i.e. difference) for each property
 * that is present in both the data and comparisonData objects.
 *
 * @param props The properties to calculate the change for
 * @param data The data object to add the results to
 * @param comparisonData The data object to compare against
 * @returns The data object with absolute change properties added
 */
export const getSelectedAbsoluteChange = <
  T2 extends Record<string, any>,
  T extends T2,
  const Props extends readonly (keyof T2)[],
  const Suffix extends string = 'Difference',
>(
  props: Props extends readonly string[] ? Props : never,
  data: T,
  comparisonData: T2,
  options: { round?: number; suffix: Suffix } = {
    suffix: 'Difference' as Suffix,
  } as const,
) => {
  const suffix = (options.suffix || 'Difference') as Suffix;

  const absoluteChangeResults = Object.fromEntries(
    props.map((prop) => [
      `${prop}${suffix}`,
      round(
        (data[prop] || 0) - (comparisonData[prop] || 0),
        options?.round || 5,
      ),
    ]),
  ) as {
    [Prop in Props[number] as `${string & Prop}${Suffix}`]: number | null;
  };

  return {
    ...data,
    ...absoluteChangeResults,
  };
};

/**
 * Similar to {@link getSelectedAbsoluteChange} but for arrays of objects
 *
 * Takes two arrays of objects and calculates the absolute change (i.e. difference) for each property
 * that is present in both the data and comparisonData arrays, finding the appropriate
 * comparison element using the specified key.
 *
 * @param props The properties to calculate the change for
 * @param joinKey The key to join the data and comparisonData arrays on
 * @param data The array of data object to add the change to
 * @param comparisonData The array of data object to compare against
 * @returns The data object with absolute change properties added
 */
export const getArraySelectedAbsoluteChange = <
  T2 extends Record<string, any>,
  T extends T2,
  const Props extends readonly (keyof T2)[],
  const Suffix extends string = 'Difference',
>(
  props: Props extends readonly string[] ? Props : never,
  joinKey: keyof T2 & string,
  data: T[] = [],
  comparisonData: T2[] = [],
  options: { round?: number; suffix: Suffix } = {
    suffix: 'Difference' as Suffix,
  } as const,
) => {
  const comparisonDict = arrayToDictionary(comparisonData, joinKey);

  return data.map((dataObj) => {
    const comparisonObj = comparisonDict[dataObj[joinKey]];

    if (!comparisonObj) {
      const emptyComparison = Object.fromEntries(
        props.map((prop) => [prop, null]),
      ) as T;

      return getSelectedAbsoluteChange(
        props,
        dataObj,
        emptyComparison,
        options,
      );
    }

    return getSelectedAbsoluteChange(props, dataObj, comparisonObj, options);
  });
};

/**
 * Gets the most recent test, or any with a success rate if no dates are present
 * @param uxTests
 */
export const getLatestTest = <T extends { date?: Date; success_rate?: number }>(
  uxTests: T[],
) =>
  uxTests.reduce(
    (latestTest, test) => {
      if (!latestTest || typeof latestTest?.date !== 'object') {
        return test;
      }

      if (!test.success_rate) {
        return latestTest;
      }

      if (test.date && test.date > latestTest.date) {
        return test;
      }

      return latestTest;
    },
    null as null | T,
  );

/**
 * Calculates the average success rate for a given array of UxTests
 * or returns null if no success rates are found.
 * @param uxTests
 */
export function getAvgTestSuccess<T extends { success_rate?: number }>(
  uxTests: T[],
) {
  const testsWithSuccessRate = uxTests
    .map((test) => test.success_rate)
    .filter(
      (successRate) => successRate !== undefined && successRate !== null,
    ) as number[];

  return avg(testsWithSuccessRate, 2);
}

/**
 *
 * @param uxTests Array of tests associated to a page/task/project
 */
export function getAvgSuccessFromLastTests<
  T extends { date?: Date; success_rate?: number; test_type?: string },
>(uxTests: T[]) {
  const uxTestsWithSuccessRate = uxTests.filter(
    (test) => test.success_rate ?? test.success_rate === 0,
  );

  const lastTest = getLatestTest(uxTestsWithSuccessRate);

  const lastTestDate: Date | null = lastTest?.date || null;

  const lastTests = lastTestDate
    ? uxTests.filter(
        (test) => test.date && test.date.getTime() === lastTestDate.getTime(),
      )
    : uxTests;

  const lastTestsByType = lastTests.reduce(
    (acc, test) => {
      if (!test.test_type) {
        return acc;
      }

      if (!(test.test_type in acc)) {
        acc[test.test_type] = [];
      }

      acc[test.test_type].push(test);

      return acc;
    },
    {} as { [key: string]: T[] },
  );

  const testTypes = Object.keys(lastTestsByType);

  if (testTypes.length === 0) {
    return null;
  }

  // If there are validation tests, take these as the "latest test"
  if ('Validation' in lastTestsByType) {
    const avgSuccess = getAvgTestSuccess(lastTestsByType['Validation']);

    if (avgSuccess) {
      return avgSuccess;
    }
  }

  // Otherwise use baseline tests
  if ('Baseline' in lastTestsByType) {
    const avgSuccess = getAvgTestSuccess(lastTestsByType['Baseline']);

    if (avgSuccess) {
      return avgSuccess;
    }
  }

  // If no validation or baseline tests, use whatever we have
  const allTests =
    testTypes.reduce(
      (acc, key) => acc.concat(lastTestsByType[key]),
      [] as T[],
    ) || [];

  if (!allTests || !allTests.length) {
    return null;
  }

  return getAvgTestSuccess(allTests);
}

export function getLatestTaskSuccessRate(
  uxTests: { date?: Date; success_rate?: number }[],
) {
  const sortedTests = [...uxTests]
    .filter(
      (test) =>
        test.date && test.success_rate != null && test.success_rate >= 0,
    )
    .sort(
      (a, b) => (b.date as Date).getTime() - (a.date as Date).getTime(),
    ) as { date: Date; success_rate: number }[];

  if (!sortedTests.length)
    return {
      avgTestSuccess: null,
      latestDate: null,
      percentChange: null,
      valueChange: null,
      total: 0,
    };

  const latestDate = sortedTests[0].date as Date;
  const secondLatestDate = sortedTests.find(
    (test) => (test.date as Date).getTime() !== latestDate.getTime(),
  )?.date;

  const avgLatestSuccess = avg(
    sortedTests
      .filter(({ date }) => date.getTime() === latestDate.getTime())
      .map(({ success_rate }) => success_rate),
    2,
  ) as number;

  const avgPreviousSuccess = secondLatestDate
    ? avg(
        sortedTests
          .filter(({ date }) => date.getTime() === secondLatestDate.getTime())
          .map(({ success_rate }) => success_rate),
        2,
      )
    : null;

  if (avgPreviousSuccess === null) {
    return {
      avgTestSuccess: avgLatestSuccess,
      latestDate,
      percentChange: null,
      valueChange: null,
      total: sortedTests.length,
    };
  }

  const successPercentChange = round(
    percentChange(avgLatestSuccess, avgPreviousSuccess),
    4,
  );
  const successValueChange = round(avgLatestSuccess - avgPreviousSuccess, 4);

  return {
    avgTestSuccess: avgLatestSuccess,
    latestDate,
    percentChange: successPercentChange,
    valueChange: successValueChange,
    total: sortedTests.length,
  };
}

export function getAvgSuccessFromLatestTests<
  T extends { date?: Date; success_rate?: number },
>(uxTests: T[]): TestSuccessWithPercentChange & { latestDate: Date | null } {
  const sortedTests = [...uxTests]
    .filter(
      (test) =>
        test.date && test.success_rate != null && test.success_rate >= 0,
    )
    .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime());

  if (!sortedTests.length)
    return {
      avgTestSuccess: null,
      latestDate: null,
      percentChange: null,
      total: 0,
    };

  const latestDate = sortedTests[0].date as Date;
  const secondLatestDate = sortedTests.find(
    (test) => (test.date as Date).getTime() !== latestDate.getTime(),
  )?.date;

  const avgTestSuccess =
    getAvgTestSuccess(
      sortedTests.filter(
        (test) => (test.date as Date).getTime() === latestDate.getTime(),
      ),
    ) ?? null;

  let avgSecondLatest = null;
  let percentChange = null;

  if (secondLatestDate) {
    avgSecondLatest =
      getAvgTestSuccess(
        sortedTests.filter(
          (test) =>
            (test.date as Date).getTime() ===
            (secondLatestDate as Date).getTime(),
        ),
      ) ?? null;
    percentChange =
      avgSecondLatest !== null
        ? (avgTestSuccess as number) - avgSecondLatest
        : null;
  }

  return {
    avgTestSuccess,
    latestDate,
    percentChange,
    total: sortedTests.length,
  };
}

export function groupTestsByType<
  T extends { date?: Date; success_rate?: number; test_type?: string },
>(uxTests: T[]) {
  return uxTests.reduce(
    (testsByType, test) => {
      if (!test.test_type) {
        testsByType['None'].push(test);

        return testsByType;
      }

      if (!(test.test_type in testsByType)) {
        testsByType[test.test_type] = [];
      }

      testsByType[test.test_type].push(test);

      return testsByType;
    },
    { None: [] } as { [key: string]: T[] },
  );
}

export function getAvgTestSuccessByDate<
  T extends { date?: Date; success_rate?: number; test_type?: string },
>(uxTests: T[]) {
  const testsByDate: { [date: string]: T[] } = { None: [] };

  for (const test of uxTests) {
    if (!test.date) {
      testsByDate['None'].push(test);
      continue;
    }

    const date = test.date.toISOString();

    if (!testsByDate[date]) {
      testsByDate[date] = [];
    }

    testsByDate[date].push(test);
  }

  const dates = Object.keys(testsByDate);

  const avgSuccessRateByDate: Record<string, number | null> = {};

  for (const date of dates) {
    avgSuccessRateByDate[date] = getAvgTestSuccess(testsByDate[date]);
  }

  return avgSuccessRateByDate;
}

export interface TestSuccessWithPercentChange {
  avgTestSuccess: number | null;
  percentChange: number | null;
  total: number | null;
}

export function getLatestTestData<
  T extends { date?: Date; success_rate?: number; test_type?: string },
>(uxTests: T[]): TestSuccessWithPercentChange {
  const uxTestsWithSuccessRate = uxTests.filter(
    (test) => test.success_rate || test.success_rate === 0,
  );

  if (!uxTestsWithSuccessRate.length) {
    return {
      avgTestSuccess: null,
      percentChange: null,
      total: null,
    };
  }

  const testsByType = groupTestsByType(uxTestsWithSuccessRate);

  const testTypesByPriority = [
    'Validation',
    'Baseline',
    'Exploratory',
    'Spot Check',
    'None',
  ];

  while (testTypesByPriority.length > 0) {
    const testType = testTypesByPriority.splice(0, 1)[0];

    if (testsByType[testType]?.length) {
      const avgTestSuccess = getAvgTestSuccess(testsByType[testType]);

      if (avgTestSuccess === null) {
        continue;
      }

      while (testTypesByPriority.length > 0) {
        const previousTestType = testTypesByPriority.splice(0, 1)[0];

        if (testsByType[previousTestType]) {
          const previousAvgTestSuccess = getAvgTestSuccess(
            testsByType[previousTestType],
          );

          const percentChange =
            previousAvgTestSuccess !== null
              ? avgTestSuccess - previousAvgTestSuccess
              : null;

          return {
            avgTestSuccess,
            percentChange,
            total: testsByType[testType]?.length,
          };
        }
      }

      return {
        avgTestSuccess,
        percentChange: null,
        total: testsByType[testType]?.length,
      };
    }
  }

  return {
    avgTestSuccess: null,
    percentChange: null,
    total: null,
  };
}

export type ProjectTestTypes = {
  Baseline: IUxTest[];
  Validation: IUxTest[];
};

export const getImprovedKpiSuccessRates = (
  uxTests: IUxTest[],
): { uniqueTasks: number; successRates: SuccessRates } => {
  const groupByTaskByProjectByTestType = pipe(
    groupBy((test: IUxTest) => test!.tasks!.toString()), // group by task
    mapObject(groupBy((test: IUxTest) => test.project.toString())), // group by project
    // group by test type (group all non-validation test types as Baseline)
    mapObject(
      mapObject(
        groupBy(({ test_type }: IUxTest) =>
          test_type === 'Validation' ? 'Validation' : 'Baseline',
        ),
      ),
    ),
  );

  // filter bad stuff
  const filteredTests = uxTests.filter(
    (test) =>
      !isNullish(test.success_rate) && test.test_type && test!.tasks!.length,
  );

  const avgTestSuccessRates = piped(
    filteredTests,
    // for tests with multiple tasks, unwind the tasks array
    map(unwind('tasks')),
    flatten,
    (tests: IUxTest[]) =>
      groupByTaskByProjectByTestType(tests) as Dictionary<
        Dictionary<ProjectTestTypes>
      >,
    // filter out projects with only 1 test type
    mapObject(
      filter(
        (projectTestTypes: any, testType: any) =>
          keys(projectTestTypes).length > 1,
      ),
    ),
    // filter out tasks with no projects
    filter((taskProjects: any, task: any) => keys(taskProjects).length > 0),
    // get the avg success rate for each test type
    mapObject<any>(
      mapObject(
        map(
          pipe(pluck('success_rate'), (successRates: unknown[]) =>
            avg(successRates as number[], 3),
          ),
        ),
      ),
    ),
    // calculate the difference between Baseline and Validation
    mapObject<any>(
      map((testTypes: any, project: any) => ({
        baseline: testTypes.Baseline,
        validation: testTypes.Validation,
        difference: round(testTypes.Validation - testTypes.Baseline, 4),
      })),
    ),

    // get avg of baseline, validation, and difference for each task over all projects
    mapObject((successRates: SuccessRates[]) => ({
      baseline: avg(pluck('baseline', successRates), 4) as number,
      validation: avg(pluck('validation', successRates), 4) as number,
      difference: avg(pluck('difference', successRates), 4) as number,
    })),
  );

  const successRates = Object.values(avgTestSuccessRates);

  const overallAvgs = {
    baseline: avg(pluck('baseline', successRates), 4) as number,
    validation: avg(pluck('validation', successRates), 4) as number,
    difference: avg(pluck('difference', successRates), 4) as number,
  };

  return {
    uniqueTasks: keys(avgTestSuccessRates).length,
    successRates: overallAvgs,
  };
};

export const getWosImprovedKpiSuccessRates = (
  uxTests: IUxTest[],
): { uniqueTasks: number; successRates: SuccessRates } => {
  const groupByTaskByProjectByTestType = pipe(
    groupBy((test: IUxTest) => test!.tasks!.toString()), // group by task
    mapObject(groupBy((test: IUxTest) => test.project.toString())), // group by project
    // group by test type (group all non-validation test types as Baseline)
    mapObject(
      mapObject(
        groupBy(({ test_type }: IUxTest) =>
          test_type === 'Validation' ? 'Validation' : 'Baseline',
        ),
      ),
    ),
  );

  // filter bad stuff
  const filteredTests = uxTests.filter(
    (test) =>
      test.wos_cops === true &&
      !isNullish(test.success_rate) &&
      test.test_type &&
      test!.tasks!.length,
  );

  const avgTestSuccessRates = piped(
    filteredTests,
    // for tests with multiple tasks, unwind the tasks array
    map(unwind('tasks')),
    flatten,
    (tests: IUxTest[]) =>
      groupByTaskByProjectByTestType(tests) as Dictionary<
        Dictionary<ProjectTestTypes>
      >,
    // filter out projects with only 1 test type
    mapObject(
      filter(
        (projectTestTypes: any, testType: any) =>
          keys(projectTestTypes).length > 1,
      ),
    ),
    // filter out tasks with no projects
    filter((taskProjects: any, task: any) => keys(taskProjects).length > 0),
    // get the avg success rate for each test type
    mapObject<any>(
      mapObject(
        map(
          pipe(pluck('success_rate'), (successRates: unknown[]) =>
            avg(successRates as number[], 3),
          ),
        ),
      ),
    ),
    // calculate the difference between Baseline and Validation
    mapObject<any>(
      map((testTypes: any, project: any) => ({
        baseline: testTypes.Baseline,
        validation: testTypes.Validation,
        difference: round(testTypes.Validation - testTypes.Baseline, 4),
      })),
    ),

    // get avg of baseline, validation, and difference for each task over all projects
    mapObject((successRates: SuccessRates[]) => ({
      baseline: avg(pluck('baseline', successRates), 4) as number,
      validation: avg(pluck('validation', successRates), 4) as number,
      difference: avg(pluck('difference', successRates), 4) as number,
    })),
  );

  const successRates = Object.values(avgTestSuccessRates);

  const overallAvgs = {
    baseline: avg(pluck('baseline', successRates), 4) as number,
    validation: avg(pluck('validation', successRates), 4) as number,
    difference: avg(pluck('difference', successRates), 4) as number,
  };

  return {
    uniqueTasks: keys(avgTestSuccessRates).length,
    successRates: overallAvgs,
  };
};

export const getImprovedKpiTopSuccessRates = (
  topTaskIds: string[],
  uxTests: IUxTest[],
): {
  uniqueTopTasks: number;
  allTopTasks: number;
  topSuccessRates: SuccessRates;
  totalTopTasksCount: number;
} => {
  const groupByTaskByProjectByTestType = pipe(
    groupBy((test: IUxTest) => test!.tasks!.toString()), // group by task
    mapObject(groupBy((test: IUxTest) => test.project.toString())), // group by project
    // group by test type (group all non-validation test types as Baseline)
    mapObject(
      mapObject(
        groupBy(({ test_type }: IUxTest) =>
          test_type === 'Validation' ? 'Validation' : 'Baseline',
        ),
      ),
    ),
  );

  // Filter UX tests by top task IDs and filter bad stuff
  const filteredTests1 = uxTests.filter(
    (test) =>
      !isNullish(test.success_rate) &&
      test.test_type &&
      test!.tasks!.length &&
      test!.tasks!.some((taskId) => topTaskIds.includes(taskId.toString())),
  );

  const avgTestTopSuccessRates = piped(
    filteredTests1,
    // for tests with multiple tasks, unwind the tasks array
    map(unwind('tasks')),
    flatten,
    (tests: IUxTest[]) =>
      groupByTaskByProjectByTestType(tests) as Dictionary<
        Dictionary<ProjectTestTypes>
      >,
    // filter out projects with only 1 test type
    mapObject(
      filter(
        (projectTestTypes: any, testType: any) =>
          keys(projectTestTypes).length > 1,
      ),
    ),
    // filter out tasks with no projects
    filter((taskProjects: any, task: any) => keys(taskProjects).length > 0),
    // get the avg success rate for each test type
    mapObject<any>(
      mapObject(
        map(
          pipe(pluck('success_rate'), (topSuccessRates: unknown[]) =>
            avg(topSuccessRates as number[], 3),
          ),
        ),
      ),
    ),
    // calculate the difference between Baseline and Validation
    mapObject<any>(
      map((testTypes: any, project: any) => ({
        baseline: testTypes.Baseline,
        validation: testTypes.Validation,
        difference: round(testTypes.Validation - testTypes.Baseline, 4),
      })),
    ),
    // get avg of baseline, validation, and difference for each task over all projects
    mapObject((topSuccessRates: SuccessRates[]) => ({
      baseline: avg(pluck('baseline', topSuccessRates), 4) as number,
      validation: avg(pluck('validation', topSuccessRates), 4) as number,
      difference: avg(pluck('difference', topSuccessRates), 4) as number,
    })),
  );

  const topSuccessRates = Object.values(avgTestTopSuccessRates);

  const top50Tasks = {
    baseline: avg(pluck('baseline', topSuccessRates), 4) as number,
    validation: avg(pluck('validation', topSuccessRates), 4) as number,
    difference: avg(pluck('difference', topSuccessRates), 4) as number,
  };

  const avgTestAllTopSuccessRates = piped(
    filteredTests1,
    // for tests with multiple tasks, unwind the tasks array
    map(unwind('tasks')),
    flatten,
    //exclude tasks not in the topTaskIds
    filter((test: any) => topTaskIds.includes(test.tasks.toString())),
    (tests: IUxTest[]) =>
      groupByTaskByProjectByTestType(tests) as Dictionary<
        Dictionary<ProjectTestTypes>
      >,
    // filter out tasks with no projects
    filter((taskProjects: any, task: any) => keys(taskProjects).length > 0),
    // get the avg success rate for each test type
    mapObject<any>(
      mapObject(
        map(
          pipe(pluck('success_rate'), (topSuccessRates: unknown[]) =>
            avg(topSuccessRates as number[], 3),
          ),
        ),
      ),
    ),
    // get avg of baseline, validation for each task over all projects
    mapObject((topSuccessRates: SuccessRates[]) => ({
      baseline: avg(pluck('baseline', topSuccessRates), 4) as number,
      validation: avg(pluck('validation', topSuccessRates), 4) as number,
    })),
  );

  return {
    uniqueTopTasks: keys(avgTestTopSuccessRates).length,
    allTopTasks: keys(avgTestAllTopSuccessRates).length,
    topSuccessRates: top50Tasks,
    totalTopTasksCount: topTaskIds.length,
  };
};
