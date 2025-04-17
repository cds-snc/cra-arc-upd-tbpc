import type { Dayjs } from 'dayjs';

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';
type Day = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28' | '29' | '30' | '31';
type Year = `20${Digit}${Digit}`;

export type BaseDate = `${ Year }-${ Month }-${ Day }`;

type AAQueryStartTime = `T00:00:00.000`;
type AAQueryEndTime = `T23:59:59.999`;

export type AAQueryDateStart = `${ BaseDate }${ AAQueryStartTime }`;
export type AAQueryDateEnd = `${ BaseDate }${ AAQueryEndTime }`;
export type AAQueryDateEndExclusive = AAQueryDateStart;

export type AbstractDate = string | Date | Dayjs;

export type DateRange<T extends AbstractDate> = {
  start: T;
  end: T;
};