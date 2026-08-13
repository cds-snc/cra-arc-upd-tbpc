import type {
  ArchivedStatus,
  PageStatus,
  PassFailStatus,
  ProjectStatus,
  ProjectType,
  TaskStatus,
} from './data.types';

type OptionalKeyOf<T = void> = T extends void
  ? string
  : T extends unknown
    ? keyof T extends string
      ? keyof T
      : string
    : any;

export type ColumnConfigPipe =
  | 'percent'
  | 'number'
  | 'date'
  | 'secondsToMinutes';

export type ColumnType =
  | 'comparison'
  | 'date'
  | 'label'
  | 'labelArray'
  | 'link'
  | 'linkArray'
  | 'markdown'
  | 'text'
  | 'textArray';

export type BaseColumnConfig<T extends object> = {
  field: keyof T & string;
  header: string;
  secondaryHeader?: string;
  group?: string;
  type?: ColumnType;
  tooltip?: string;
  translate?: boolean;
  filterConfig?: FilterConfig<T>;
  hide?: boolean;
  headerClass?: string;
  columnClass?: string;
  frozen?: boolean;
  width?: string;
  center?: boolean;
};

export type DateColumnConfig = {
  // passed to the angular date pipe, e.g. 'shortDate', 'yyyy-MM-dd', etc.
  format?: string;
};

export type LinkColumnConfig = {
  link: string;
  preLink?: string;
  postLink?: string;
  external?: boolean;
};

// "array" column types use an inline config
export type LinkArrayColumnConfig = {
  linkText: string;
  linkHrefSegments: string[];
  external?: boolean;
};

// @@@@@@@@@@@@@@@@@@@@ 
// @@@@@@@@@@@@@@@@@@@@ Work through this one part at a time:
// @@@@@@@@@@@@@@@@@@@@ - Finish this file so that it's internally consistent
// @@@@@@@@@@@@@@@@@@@@   - Figure out if there's actually a purpose to the "comparison" type and what the difference is between that and using `showTextColours`, etc.
// @@@@@@@@@@@@@@@@@@@@   - Set up a number/numeric type?
// @@@@@@@@@@@@@@@@@@@@   - probably other stuff
// @@@@@@@@@@@@@@@@@@@@
// @@@@@@@@@@@@@@@@@@@@ - Clean up and refactor data-table-styles
// @@@@@@@@@@@@@@@@@@@@   - get rid of useless stuff like "numberVal"?
// @@@@@@@@@@@@@@@@@@@@   - streamline confusing logic for indicators, arrows, etc.
// @@@@@@@@@@@@@@@@@@@@   - implement new logic (should be very streamlined by comparison)
// @@@@@@@@@@@@@@@@@@@@   - probably other stuff
// @@@@@@@@@@@@@@@@@@@@
// @@@@@@@@@@@@@@@@@@@@ - Most likely will want/need to use a colConfig factory function of sorts, to get proper type inference and stuff
// @@@@@@@@@@@@@@@@@@@@   - 
// @@@@@@@@@@@@@@@@@@@@
// @@@@@@@@@@@@@@@@@@@@ - ????
// @@@@@@@@@@@@@@@@@@@@
// @@@@@@@@@@@@@@@@@@@@ - If the refactor seems sound, try and get claude/codex to refactor all existing colConfigs
// @@@@@@@@@@@@@@@@@@@@ - 
// @@@@@@@@@@@@@@@@@@@@ - Make sure data-table-exports works properly
// @@@@@@@@@@@@@@@@@@@@   - with translations too
// @@@@@@@@@@@@@@@@@@@@
// @@@@@@@@@@@@@@@@@@@@ - Make sure table filters all work properly
// @@@@@@@@@@@@@@@@@@@@   - with translations too
// @@@@@@@@@@@@@@@@@@@@
// @@@@@@@@@@@@@@@@@@@@ - you can now move on with your life?
// @@@@@@@@@@@@@@@@@@@@ 

// prob not this
export type ComparisonColumnConfig = {
  upGoodDownBad?: boolean;
  useArrows?: boolean;
  showTextColours?: boolean;
};

export type LabelType =
  | 'projectStatus'
  | 'projectType'
  | 'pageStatus'
  | 'taskStatus'
  | 'archivedStatus'
  | 'passFail';

export type LabelClassMapKey<T extends LabelType> = T extends 'projectStatus'
  ? ProjectStatus
  : T extends 'projectType'
    ? ProjectType
    : T extends 'pageStatus'
      ? PageStatus
      : T extends 'taskStatus'
        ? TaskStatus
        : T extends 'archivedStatus'
          ? ArchivedStatus
          : T extends 'passFail'
            ? PassFailStatus
            : never;

export type LabelColumnConfig = {
  labelType: LabelType;
};

export type LabelArrayColumnConfig<T extends LabelType> = {
  labelType: T;
  labelValue: LabelClassMapKey<T>;
};

export type TextArrayColumnConfig = {
  separator?: string;
};

// not this
export type ColumnTypeConfig<T extends ColumnType> = T extends 'link'
  ? { link: string; preLink?: string; postLink?: string; external?: boolean }
  : T extends 'comparison'
    ? {
        upGoodDownBad?: boolean;
        useArrows?: boolean;
        showTextColours?: boolean;
      }
    : T extends 'label'
      ? { labelType: LabelType }
      : T extends 'text'
        ? {}
        : T extends 'markdown'
          ? {}
          : never;

export interface ColumnConfig<
  T extends Record<string, unknown>,
  ColName extends keyof T,
> {
  field: ColName;
  header: string;
  secondaryHeader?: string;
  group?: string;
  type?: ColumnType;
  typeParams?: this['type'] extends ColumnType
    ? ColumnTypeConfig<this['type']>
    : undefined;
  pipe?: ColumnConfigPipe;
  pipeParam?: string;
  tooltip?: string;
  translate?: boolean;
  filterConfig?: FilterConfig<T>;
  hide?: boolean;
  headerClass?: string;
  columnClass?: string;
  frozen?: boolean;
  indicator?: boolean;
  secondaryField?: SecondaryField<T>;
  upGoodDownBad?: boolean;
  useArrows?: boolean;
  showTextColours?: boolean;
  width?: string;
  center?: boolean;
}

export type GroupedColumns<T extends Record<string, unknown>> = {
  label: string;
  items: ColumnConfig<T, never>[];
};

export interface typeParams {
  link: string;
  preLink?: string;
  postLink?: string;
  external?: boolean;
  multiLinks?: boolean;
  linksField?: string;
}

export interface FilterConfig<T = any> {
  type: 'category' | 'boolean';
  categories?: { name: string; value: T[keyof T] | null }[];
  matchMode?: string;
}

export interface SecondaryField<T = any> {
  field: OptionalKeyOf<T>;
  pipe?: ColumnConfigPipe;
  pipeParam?: string;
}
