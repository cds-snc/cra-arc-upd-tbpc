/*
 * Type utilities
 */
import type { Signal } from '@angular/core';
import type { Model, Types } from 'mongoose';
import type { Observable } from 'rxjs';

/**
 * Returns an interface with only the properties of the given type
 */
export type PickByType<T, Value> = {
  [P in keyof T as T[P] extends Value ? P : never]: T[P];
};

export type KeysOfType<T, Value> = keyof PickByType<T, Value>;

export type WithObjectId<T> = T & { _id: Types.ObjectId };

export type OmitId<T> = Omit<T, '_id'>;

/**
 * Optional generic type returning a key of the given type
 */
export type OptionalKeyOf<T = void> = T extends void
  ? string
  : T extends unknown
    ? keyof T extends string
      ? keyof T
      : string
    : any;

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

/**
 * For getting the inner type of a Promise
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

export type GetTableProps<
  Class,
  Field extends keyof Class,
> = Class extends never
  ? string
  : Class extends unknown
    ? UnwrapObservable<Class[Field]>
    : string;

export type ModelWithStatics<T, Statics> = Model<T> & {
  [key in keyof Statics]: Statics[key];
};
