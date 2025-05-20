import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'upd-input-switch',
    templateUrl: './input-switch.component.html',
    styleUrls: ['./input-switch.component.scss'],
    standalone: false
})
export class InputSwitchComponent {
  @Input() id?: string;
  @Input() checked = false;
  @Input() disabled = false;
  @Input() text = '';

  @Output() checkedChange = new EventEmitter<boolean>();

  onCheckedChange() {
    this.checkedChange.emit(this.checked);
  }
}
