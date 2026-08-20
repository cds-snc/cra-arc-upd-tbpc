import type {
  ArchiveStatus,
  PageStatus,
  PassFailStatus,
  ProjectStatus,
  ProjectType,
  TaskStatus,
} from './data.types';

export type ColumnConfigPipe =
  | 'percent'
  | 'number'
  | 'date'
  | 'secondsToMinutes';

export type ColumnType = 'link' | 'label' | 'change' | 'markdown';

export type ColumnKey<T = Record<string, unknown>> = [keyof T] extends [never]
  ? string
  : string extends keyof T
    ? string
    : Extract<keyof T, string>;

export interface FilterConfig<T = unknown> {
  type: 'category' | 'boolean';
  categories?: { name: string; value: T | null }[];
  matchMode?: string;
}

export interface SecondaryField<Field extends string = string> {
  field: Field;
  pipe?: ColumnConfigPipe;
  pipeParam?: string;
}

export interface LabelValueMap {
  projectStatus: ProjectStatus;
  projectType: ProjectType;
  pageStatus: PageStatus;
  taskStatus: TaskStatus;
  archiveStatus: ArchiveStatus;
  passFail: PassFailStatus;
}

export type LabelType = keyof LabelValueMap;
export type LabelValue = LabelValueMap[LabelType];
export type NonEmptyLabelTypes = readonly [LabelType, ...LabelType[]];
export type LabelValueFor<Kinds extends NonEmptyLabelTypes> =
  LabelValueMap[Kinds[number]];

type LabelFieldKey<
  Row,
  Kinds extends NonEmptyLabelTypes,
> = [keyof Row] extends [never]
  ? string
  : string extends keyof Row
  ? string
  : {
      [Key in keyof Row]-?: NonNullable<Row[Key]> extends
        | LabelValueFor<Kinds>
        | readonly LabelValueFor<Kinds>[]
        ? Key
        : never;
    }[keyof Row] & string;

interface BaseColumnConfig<
  Row = Record<string, unknown>,
  Field extends string = ColumnKey<Row>,
> {
  field: Field;
  header: string;
  secondaryHeader?: string;
  group?: string;
  pipe?: ColumnConfigPipe;
  pipeParam?: string;
  tooltip?: string;
  translate?: boolean;
  filterConfig?: FilterConfig;
  hide?: boolean;
  headerClass?: string;
  columnClass?: string;
  frozen?: boolean;
  width?: string;
  center?: boolean;
}

export type ValueColumnConfig<Row = Record<string, unknown>> =
  BaseColumnConfig<Row> & {
    type?: undefined;
  };

export type LinkColumnConfig<Row = Record<string, unknown>> =
  BaseColumnConfig<Row> & {
    type: 'link';
    link: ColumnKey<Row>;
    preLink?: string;
    postLink?: string;
    external?: boolean;
  };

export type LabelColumnConfig<
  Row = Record<string, unknown>,
  Kinds extends NonEmptyLabelTypes = NonEmptyLabelTypes,
> = BaseColumnConfig<Row, LabelFieldKey<Row, Kinds>> & {
  type: 'label';
  labelTypes: Kinds;
};

export type ChangeColumnConfig<Row = Record<string, unknown>> =
  BaseColumnConfig<Row> & {
    type: 'change';
    indicator?: 'arrow' | 'sign';
    colour?: 'up-good' | 'down-good' | 'none';
    secondaryField?: SecondaryField<ColumnKey<Row>>;
  };

export type MarkdownColumnConfig<Row = Record<string, unknown>> =
  BaseColumnConfig<Row> & {
    type: 'markdown';
  };

export type ColumnConfig<Row = Record<string, unknown>> =
  | ValueColumnConfig<Row>
  | LinkColumnConfig<Row>
  | LabelColumnConfig<Row>
  | ChangeColumnConfig<Row>
  | MarkdownColumnConfig<Row>;

export type GroupedColumns<Row = Record<string, unknown>> = {
  label: string;
  items: ColumnConfig<Row>[];
};

export const labelColumn = <Row = Record<string, unknown>>() =>
  <const Kinds extends NonEmptyLabelTypes>(
    config: LabelColumnConfig<Row, Kinds>,
  ): LabelColumnConfig<Row, Kinds> =>
    config;
