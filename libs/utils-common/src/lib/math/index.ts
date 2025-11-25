/*
 * For mathematical functions that could be used in multiple projects
 */

export const percentChange = (
  currentValue: number,
  previousValue: number,
  roundToDecimals?: number,
) => {
  const change = (currentValue - previousValue) / previousValue;
  return roundToDecimals !== undefined
    ? round(change, roundToDecimals)
    : change;
};

export const sum = (array: number[]) =>
  array.reduce((total, term) => term + total, 0);

export const round = (num: number, digits: number) => {
  const pow = Math.pow(10, digits);

  return Math.round(num * pow) / pow;
};

export const avg = (array: number[], roundToDecimals?: number) => {
  if (!array.length) return null;

  const average = sum(array) / array.length;

  return roundToDecimals ? round(average, roundToDecimals) : average;
};
