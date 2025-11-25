import {
  Component,
  Input,
  ViewChild,
  EventEmitter,
  Output,
  input,
  computed,
  inject,
  effect,
  signal,
  WritableSignal,
} from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { Table } from 'primeng/table';
import type { ColumnConfig } from '@dua-upd/types-common';
import type { SelectedNode } from '../filter-table/filter-table.component';
import { toGroupedColumnSelect } from '@dua-upd/upd/utils';
import { SortEvent } from 'primeng/api';
import { FilterService } from 'primeng/api';
import { isNullish } from '@dua-upd/utils-common';

@Component({
  selector: 'upd-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.css'],
  standalone: false,
})
export class DataTableComponent<T extends object> {
  @ViewChild('dt') table!: Table;
  @Input() displayRows = 10;
  @Input() sort = true;
  @Input() pagination = true;
  @Input() filter = true;
  @Input() filterTree = false;
  @Input() captionTitle = '';
  @Input() loading = false;
  @Input() sortField = '';
  @Input() sortOrder: 'asc' | 'desc' = 'asc';
  @Input() kpi = false;
  @Input() exports = true;
  @Input() checkboxes = false;
  @Input() expandable = false;
  @Input() id?: string;
  @Input() placeholderText = 'dt_search_keyword';
  @Input() selectedNodes: SelectedNode[] = [];
  @Input() allowHeaderWrap = false;

  node: SelectedNode | null = null;

  @Output() rowSelectionChanged = new EventEmitter<T[]>();
  i18n = inject(I18nFacade);
  filterService = inject(FilterService);

  data = input<T[] | null>(null);
  // eslint-disable-next-line @angular-eslint/no-input-rename
  initialCols = input<ColumnConfig<T>[]>([], { alias: 'cols' });
  // eslint-disable-next-line @angular-eslint/no-input-rename
  inputSearchFields = input<string[]>([], { alias: 'searchFields' });
  columnSelection = input(false);
  groupedColumnSelection = input(false);
  resizableColumns = input(false);

  cols = this.i18n.service.computedMap(this.initialCols, (col, translate) => ({
    ...col,
    header: translate(col.header),
  }));

  translatedData = this.i18n.toTranslatedTable<T>(this.data, this.cols);

  selectedColumns: WritableSignal<ColumnConfig<T>[]> = signal(
    JSON.parse(sessionStorage.getItem(`selectedColumns-${this.id}`) || '[]'),
  );

  selectedColumnsSynced = computed(() => {
    const selectedColumnFields = this.selectedColumns().map(
      ({ field }) => field,
    );

    return this.cols().filter((col) =>
      selectedColumnFields.includes(col.field),
    );
  });

  searchFields = computed(() =>
    this.inputSearchFields().length
      ? this.inputSearchFields()
      : this.cols().map((col) => col.field),
  );

  displayColumns = computed(() => {
    if (!this.selectedColumns()?.length || !this.columnSelection()) {
      return this.cols().filter((col) => !col.hide);
    }

    return this.cols().filter(
      (col) =>
        col.frozen ||
        this.selectedColumns()
          ?.map(({ field }) => field)
          .includes(col.field),
    );
  });

  lang = this.i18n.currentLang;

  isSorted: boolean | null = null;

  selectableCols = computed(() => {
    const cols = this.cols()
      .filter((col: ColumnConfig) => !col.frozen)
      .sort((a: ColumnConfig, b: ColumnConfig) =>
        a.header.localeCompare(b.header),
      );

    if (this.groupedColumnSelection()) {
      return toGroupedColumnSelect(cols);
    }

    return cols;
  });

  expandedRows = {};

  constructor() {
    effect(() => {
      this.translatedData();
      this.table?._filter();
      this.table?.clearState();
    });
    effect(() => {
      this.filterService.register(
        'arrayFilter',
        (value: string[], filters: string[]): boolean => {
          if (!filters?.length) {
            return true;
          }

          if (!value) {
            return false;
          }

          return filters.some((v) => value.includes(v));
        },
      );
    });
    effect(
      () => {
        const selectedColumns = this.selectedColumns();

        const initialColumns: ColumnConfig<T>[] =
          JSON.parse(
            sessionStorage.getItem(`selectedColumns-${this.id}`) || '[]',
          ) || this.cols().filter((col) => !col.hide && !col.frozen);

        if (!selectedColumns.length && initialColumns.length) {
          this.selectedColumns.set(initialColumns);
          return;
        }
      }
    );
  }

  multiKeywordGlobalFilter(table: Table, event: Event) {
    const input = (event.target as HTMLInputElement).value;

    const keywords = input
        .toLowerCase()
        .split(' ')
        .map((k) => k.trim())
        .filter(Boolean);

    table.filters['global'] = {
        value: keywords,
        matchMode: 'globalAndFilter'
    };

    table._filter();
}

  selectedRows: T[] = [];

  onSelectionChange(value = []) {
    this.selectedRows = value;
    this.rowSelectionChanged.emit(value);
  }

  clearSelections() {
    this.selectedRows = [];
    this.rowSelectionChanged.emit(this.selectedRows);
  }

  getEventValue(event: Event): string {
    return (event.target as HTMLInputElement).value.replace(
      /^.+?(?=www\.)/i,
      '',
    );
  }

  updateSelectedNodes(nodes: SelectedNode[]) {
    this.selectedNodes = nodes;
  }

  removeNode(node: SelectedNode) {
    this.node = node;
  }

  selectedColumnsChanged(selectedColumns: ColumnConfig[]) {
    sessionStorage.setItem(
      `selectedColumns-${this.id}`,
      JSON.stringify(selectedColumns),
    );

    this.selectedColumns.set(selectedColumns);
  }

  customSort(event: SortEvent) {
    event.data?.sort((a, b) => {
      a = a[event.field as keyof typeof a];
      b = b[event.field as keyof typeof b];

      const order = event.order === 1 ? 1 : -1;

      // if a is nullish, it goes to the end
      if (isNullish(a) || a === '') {
        return 1;
      }

      // if b is nullish, it goes to the end
      if (isNullish(b) || b === '') {
        return -1;
      }

      if (typeof a === 'string') {
        return a.localeCompare(b) * order;
      }

      return (a - b) * order;
    });
  }

  ngOnInit() {
    this.filterService.register('globalAndFilter', (value: any, filters: string[]) => {
      if (!filters?.length) return true;
      if (!value) return false;
      const val = String(value).toLowerCase();
      return filters.every((keyword) => val.includes(keyword));
    });
  }
}
