import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { LocaleId } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import { FilterService } from 'primeng/api';
import type { TreeNode } from 'primeng/api';
import { Table } from 'primeng/table';
import { TreeSelect } from 'primeng/treeselect';
import { FilterTableStore } from './filter-table.store';
import type { ColumnConfig } from '@dua-upd/types-common';

export interface SelectedNode {
  header: string;
  label: string;
  value: string;
}

interface SelectedItem {
  key: string;
}

@Component({
    selector: 'upd-filter-table',
    templateUrl: './filter-table.component.html',
    styleUrls: ['./filter-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [FilterTableStore],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class FilterTableComponent<T extends object> implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly filterTableStore = inject(FilterTableStore<T>);
  private filterService = inject(FilterService);

  @Input() cols: ColumnConfig<T>[] = [];
  _data: T[] = [];
  @Input() set data(value: T[]) {
    this._data = value;

    const d = [this._data, this.cols] as [T[], ColumnConfig<T>[]];
    this.filterTableStore.setData(d);
    const lang = this.i18n.currentLang();
      this.filterTableStore.setLabels(lang);
      this.updateNodeLabels(lang);
  }

  get data() {
    return this._data;
  }

  @Input() set removedNode(node: SelectedNode | null) {
    if (node) {
      this.deleteFilter(node);
    }
  }

  selectedItems: SelectedItem[] = [];
  selectedNodes: SelectedNode[] = [];

  @Output() changedSelectedNodes = new EventEmitter<SelectedNode[]>();

  @Input() table!: Table;
  @ViewChild('treeSelect') treeSelect!: TreeSelect;

  readonly vm$ = this.filterTableStore.vm$;

  ngOnInit() {
    this.filterService.register('arrayFilter', arrayFilter);
  }

  private updateNodeLabels(lang: LocaleId) {
    const headers = new Set<string>();

    if (this.selectedNodes.length > 0) {
      for (const node of this.selectedNodes) {
        const [data, child] = node.header.split('|');
        node.label = this.i18n.service.translate(child, lang);
        node.value = this.i18n.service.translate(data, lang);

        headers.add(node.header);
        headers.add(`${data}|${data}`);
      }

      this.selectedItems = Array.from(headers).map((header) => {
        this.tableFilter(header);
        return { key: header };
      });

      this.treeSelect.value = this.selectedItems;
    }
  }

  private handleNodeSelectUnselect(
    { node }: { node: TreeNode<string> },
    selected: boolean,
  ) {
    const { label, data, parent } = node;

    if (!data) {
      return;
    }

    const parentValue = parent?.label as string;

    const selectedNode = node.children?.map((child) => ({
      header: `${data?.split('|')[0]}|${child?.data?.split('|')[1]}`,
      label: child.label as string,
      value: label as string,
    })) ?? [
      {
        header: data,
        label: label as string,
        value: parentValue,
      },
    ];

    for (const node of selectedNode) {
      const nodeExists = this.selectedNodes.find(
        ({ header, label }) =>
          header.includes(data?.split('|')?.[0]) && label === node.label,
      );

      if ((selected && !nodeExists) || (!selected && nodeExists)) {
        selected
          ? this.selectedNodes.push(node)
          : this.deleteSelectedNode(node);
      }
    }

    this.changedSelectedNodes.emit(this.selectedNodes);

    this.tableFilter(data);
  }

  private deleteSelectedNode(nodeToDelete: SelectedNode) {
    this.selectedNodes = this.selectedNodes.filter((selectedNode) => {
      return (
        selectedNode.header !== nodeToDelete.header ||
        selectedNode.label !== nodeToDelete.label ||
        selectedNode.value !== nodeToDelete.value
      );
    });
  }

  onNodeSelect(event: { node: TreeNode }) {
    this.handleNodeSelectUnselect(event, true);
  }

  onNodeUnselect(event: { node: TreeNode }) {
    this.handleNodeSelectUnselect(event, false);
  }

  clearNodes() {
    this.treeSelect.value = [];
    this.selectedNodes = [];
    this.table.filters = {};
    this.table?.clear();
    this.changedSelectedNodes.emit(this.selectedNodes);
  }

  deleteFilter(node: SelectedNode) {
    this.selectedNodes = this.selectedNodes.filter(
      (n) => n.header !== node.header || n.label !== node.label,
    );
    this.changedSelectedNodes.emit(this.selectedNodes);
    this.tableFilter(node.header);
    this.treeSelect.value = this.treeSelect.value.filter(
      (n: { key: string; label: string }) => n.key !== node.header,
    );
  }

  private tableFilter(header: string) {
    const [column] = header.split('|');
    const filteredData = this.selectedNodes
      .filter((node) => node.header.includes(column))
      .map((node) => node.header.split('|')[1]);

    const filterType = this.filterMode(this.data, column as keyof T);

    this.table?.filter(filteredData, column, filterType);
  }

  get nodeSelectionCount() {
    return this.selectedNodes.length;
  }

  filterMode = (data: T[], column: keyof T) => {
    const columnValues = data
      .map((row) => row[column])
      .filter((value) => value || value === 0);

    if (columnValues.every((v) => typeof v === 'boolean')) {
      return 'equals';
    } else if (columnValues.every((v) => Array.isArray(v))) {
      return 'arrayFilter';
    } else if (columnValues.every((v) => isValidDate(v as string))) {
      return 'arrayFilter';
    } else {
      return 'in';
    }
  };
}

const arrayFilter = (value: string[], filters: string[]): boolean => {
  if (!filters?.length) {
    return true;
  }

  if (!value) {
    return false;
  }

  return filters.some((v) => value.includes(v));
};

function isValidDate(value: string) {
  const date = value.replace(/\s/g, '');
  if (date.length < 3) {
    return false;
  }
  return Date.parse(date) > 0;
}
