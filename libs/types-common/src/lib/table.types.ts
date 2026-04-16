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

export interface ColumnConfig<T = any> {
  field: OptionalKeyOf<T>;
  header: string;
  group?: string;
  type?: 'link' | 'comparison' | 'label' | 'text';
  typeParam?: string;
  typeParams?: typeParams;
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

export type GroupedColumns<T> = {
  label: string;
  items: ColumnConfig<T>[];
}

export interface typeParams {
  link: string;
  preLink?: string;
  postLink?: string;
  external?: boolean;
}

export interface FilterConfig<T = any> {
  type: 'category' | 'boolean' | 'passFail' | 'pageStatus';
  categories?: { name: string; value: T[keyof T] | null }[];
  matchMode?: string;
}

export interface SecondaryField<T = any> {
  field: OptionalKeyOf<T>;
  pipe?: ColumnConfigPipe;
  pipeParam?: string;
}