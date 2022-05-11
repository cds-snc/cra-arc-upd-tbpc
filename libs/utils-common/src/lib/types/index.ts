/*
 * Type utilities
 */
import { Types } from 'mongoose';
import { Observable } from 'rxjs';

/**
 * Returns an interface with only the properties of the given type
 */
export type PickByType<T, Value> = {
  [P in keyof T as T[P] extends Value | undefined ? P : never]: T[P];
};

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

export type GetTableProps<
  Class,
  Field extends keyof Class
> = Class extends never
  ? string
  : Class extends unknown
  ? UnwrapObservable<Class[Field]>
  : string;
