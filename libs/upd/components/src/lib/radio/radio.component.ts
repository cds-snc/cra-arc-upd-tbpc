import {
  Component,
  EventEmitter,
  input,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { Required } from '@dua-upd/utils-common';

export interface RadioOption<T> {
  value: string;
  label: string;
  description: string;
}

@Component({
    selector: 'upd-radio',
    templateUrl: './radio.component.html',
    styleUrls: ['./radio.component.scss'],
    standalone: false
})
export class RadioComponent<
  T extends { value: string; label: string; description: string },
> implements OnInit
{
  @Input() items: T[] = [];
  @Input() selectAllText = '';
  @Input() @Required id!: string;
  @Input() disabled = false;
  @Input() displayTooltip = true;
  @Input() autoDisplayFirst = false;

  @Input() selectedItem?: RadioOption<T>;
  @Output() selectedItemsChange = new EventEmitter<T>();

  @Input() set initialSelection(
    option: RadioOption<T> | RadioOption<T>['value'] | undefined,
  ) {
    if (!option) {
      return;
    }

    if (typeof option === 'object' && 'label' in option && 'value' in option) {
      this.selectedItem = option;
      return;
    }

    this.selectedItem =
      this.items.find((o) => o.value === option);
  }
  onSelectionChange(item: T) {
    this.selectedItem = item;
    this.selectedItemsChange.emit(item);
  }

  ngOnInit() {
    if (this.autoDisplayFirst && this.items.length > 0) {
      this.selectedItem = this.items[0];
    }
  }
}
