import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { I18nModule } from '@dua-upd/upd/i18n';

@Component({
  standalone: true,
  selector: 'upd-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nModule],
  template: `
    <div class="d-inline-flex flex-column">
      @if (label()) {
        <label [for]="id()" class="form-label mb-0">{{
          label() || '' | translate
        }}</label>
      }
      <span class="d-flex flex-row">
        <input
          type="range"
          [min]="min()"
          [max]="max()"
          [step]="step()"
          [value]="value()"
          [class]="'form-range flex-grow-1 d-inline align-bottom me-2 ' + styleClass"
          [id]="id()"
          (input)="valueChange($event)"
        />
        <span>{{ value() }}</span>
      </span>
    </div>
  `,
  styles: ``,
})
export class RangeSliderComponent {
  label = input<string>();
  value = model.required<number>();
  min = input(0);
  max = input(1);
  step = input(0.01);
  styleClass = input('slider');
  id = input('myRange');

  valueChange(event: Event) {
    this.value.set((event.target as HTMLInputElement).valueAsNumber);
  }
}
