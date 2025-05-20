import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Required } from '@dua-upd/utils-common';

@Component({
    selector: 'upd-checkbox',
    templateUrl: './checkbox.component.html',
    styleUrls: ['./checkbox.component.scss'],
    standalone: false
})
export class CheckboxComponent<
  T extends { value: string; label: string; description: string },
> {
  @Input() showSelectAll = false;
  @Input() items: T[] = [];
  @Input() selectAllText = '';
  @Input() invalid = false;
  @Input() @Required id!: string;

  private _selectedItems: T['value'][] = [];
  @Input() set selectedItems(value: T['value'][]) {
    this._selectedItems = value;
    this.updateSelectionState();
  }
  get selectedItems(): string[] {
    return this._selectedItems;
  }

  @Output() selectedItemsChange = new EventEmitter<T['value'][]>();

  allSelected = false;
  isIndeterminate = false;

  toggleSelectAll() {
    if (this.isIndeterminate || !this.allSelected) {
      this.selectAll();
    } else {
      this.deselectAll();
    }
    this.isIndeterminate = false;
    this.selectedItemsChange.emit(this.selectedItems);
  }

  selectAll() {
    this.selectedItems = this.items.map((item) => item.value);
    this.allSelected = true;
  }

  deselectAll() {
    this.selectedItems = [];
    this.allSelected = false;
  }

  updateIndividualSelection() {
    this.updateSelectionState();
    this.selectedItemsChange.emit(this.selectedItems);
  }

  updateSelectionState() {
    const totalItems = this.items.length;
    const selectedCount = this.selectedItems.length;

    if (selectedCount === 0) {
      this.allSelected = false;
      this.isIndeterminate = false;
    } else if (selectedCount === totalItems) {
      this.allSelected = true;
      this.isIndeterminate = false;
    } else {
      this.allSelected = false;
      this.isIndeterminate = true;
    }
  }
}
