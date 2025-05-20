import {
  Component,
  Input,
  OnInit,
  Output,
  EventEmitter,
  effect,
  input,
} from '@angular/core';
import { isNullish, Required } from '@dua-upd/utils-common';

export interface DropdownOption<T> {
  label: string;
  value: T | null;
  styleClasses?: string;
  icon?: string;
}

@Component({
    selector: 'upd-dropdown',
    template: `
    <p-select
      [options]="this.placeholder ? displayedOptions : options"
      optionLabel="label"
      [(ngModel)]="selectedOption"
      (onChange)="
        this.selectOption.emit(selectedOption);
        this.displayPlaceholder(actionOnly)
      "
      filterValue="placeholder"
      filterMatchMode="notEquals"
      (onShow)="this.showOptions()"
      (onHide)="this.hideOptions()"
    >
      <ng-template pTemplate="selectedItem">
        <span
          *ngIf="icon"
          class="material-icons align-top pe-1 "
          aria-hidden="true"
          >{{ icon }}</span
        >
        <span class="dropdown-label">{{
          selectedOption?.label || '' | translate
        }}</span>
      </ng-template>

      <ng-template pTemplate="item" let-option>
        <div [class]="option.styleClasses || ''">
          <span
            *ngIf="option.icon"
            class="pe-1 pi pi-{{ option.icon }} me-2"
            aria-hidden="true"
          ></span
          >{{ option.label | translate }}
        </div>
      </ng-template>
    </p-select>
  `,
    styles: [
        `
      .dropdown-label {
        font-family: 'Noto Sans', sans-serif;
        font-size: 1rem;
      }
    `,
    ],
    standalone: false
})
export class DropdownComponent<T> implements OnInit {
  @Input() @Required id!: string;
  @Input() label?: string;
  @Input() options: DropdownOption<T>[] = [];
  @Input() display = 'inline-block';
  @Input() bg = 'white';
  @Input() styleClasses = '';
  @Input() icon?: string;
  @Input() autoDisplayFirst = false;
  @Input() placeholder?: DropdownOption<'placeholder'>;

  // only perform an action on select, always display the placeholder
  @Input() actionOnly = false;

  @Output() selectOption = new EventEmitter<DropdownOption<T>>();

  initialSelection = input<
    DropdownOption<T> | DropdownOption<T>['value'] | void
  >(null);

  displayedOptions = this.placeholder ? [this.placeholder] : this.options;

  selectedOption?: DropdownOption<T> = this.placeholder as DropdownOption<T>;

  constructor() {
    effect(() => {
      this.setInitialSelection();
    });
  }

  displayPlaceholder(bool = true) {
    if (bool) {
      this.displayedOptions = [this.placeholder as DropdownOption<T>];
      this.selectedOption = this.placeholder as DropdownOption<T>;
      return;
    }

    this.displayedOptions = this.options;
  }

  showOptions() {
    if (!this.placeholder) return;

    this.displayedOptions = this.options;
  }

  hideOptions() {
    if (!this.placeholder) return;

    this.displayedOptions = this.placeholder
      ? [this.placeholder]
      : this.options;
  }

  setInitialSelection() {
    const initialSelection = this.initialSelection();

    if (isNullish(initialSelection)) return;

    const selectionIsObject =
      initialSelection &&
      typeof initialSelection === 'object' &&
      'value' in initialSelection;

    const selectionValue = (
      selectionIsObject ? initialSelection.value : initialSelection
    ) as string;

    const option = this.options.find((o) => o.value === selectionValue);

    if (
      (option && !this.selectedOption) ||
      (this.selectedOption?.value === option?.value &&
        this.selectedOption?.label !== option?.label)
    ) {
      this.selectedOption = option;
    }
  }

  ngOnInit() {
    if (!isNullish(this.selectedOption)) {
      return;
    }

    if (this.initialSelection()) {
      this.setInitialSelection();
      return;
    }

    if (this.autoDisplayFirst) {
      this.selectedOption = this.options[0];
      return;
    }

    if (this.placeholder) {
      this.displayPlaceholder();
    }
  }
}
