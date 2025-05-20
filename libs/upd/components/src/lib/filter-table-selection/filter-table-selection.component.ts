import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { SelectedNode } from '../filter-table/filter-table.component';

@Component({
    selector: 'upd-filter-table-selection',
    templateUrl: './filter-table-selection.component.html',
    styleUrls: ['./filter-table-selection.component.scss'],
    standalone: false
})
export class FilterTableSelectionComponent {
  @Input() selectedNodes: SelectedNode[] = [];
  @Output() nodeRemoved = new EventEmitter<SelectedNode>();

  deleteFilter(node: SelectedNode) {
    this.nodeRemoved.emit(node);
  }

  get nodeSelectionCount() {
    return this.selectedNodes.length;
  }
}