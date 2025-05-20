import { Component, Input } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';

@Component({
    selector: 'upd-data-table-card',
    templateUrl: './data-table-card.component.html',
    styleUrls: ['./data-table-card.component.css'],
    standalone: false
})
export class DataTableCardComponent<T> {
  @Input() data: T[] = [];
  @Input() displayRows = 10;
  @Input() sort = true;
  @Input() pagination = true;
  @Input() filter = true;
  @Input() filterTree = false;
  @Input() cols: ColumnConfig[] = [];
  @Input() searchFields: string[] = [];
  @Input() captionTitle = '';
  @Input() kpi = false;
  @Input() modal = '';
  @Input() modalSize: 'xl' | 'lg' | 'md' | 'sm' = 'md';
  @Input() sortField = '';
  @Input() sortOrder: 'asc' | 'desc' = 'asc';
  @Input() title = '';
  @Input() tooltip = '';
  @Input() loading = false;
  @Input() id?: string;
  @Input() emptyStateMessage?: string;
  @Input() allowHeaderWrap = false;

  get defaultSearchFields() {
    return this.cols.map((obj) => obj.field);
  }
}
