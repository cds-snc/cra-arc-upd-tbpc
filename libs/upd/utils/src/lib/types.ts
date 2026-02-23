import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';

/**
 * For getting property keys of a type from an object array wrapped in an Observable
 */
export type UnwrapObservable<T = void> = T extends void
  ? void
  : T extends Observable<infer U>
    ? U extends Array<infer V>
      ? V
      : U
    : T;

/**
 * For getting property keys of a type from an object array wrapped in a Signal
 */
export type UnwrapSignal<T = void> = T extends void
  ? void
  : T extends Signal<infer U>
    ? U extends Array<infer V>
      ? V
      : U
    : T;

export type GetTableProps<
  Class,
  Field extends keyof Class,
> = Class extends never
  ? string
  : Class extends unknown
    ? UnwrapObservable<Class[Field]>
    : string;
