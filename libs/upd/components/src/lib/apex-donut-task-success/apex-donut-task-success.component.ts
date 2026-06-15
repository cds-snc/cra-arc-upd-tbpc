import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ApexNonAxisChartSeries } from 'ng-apexcharts';
import { I18nFacade } from '@dua-upd/upd/state';
import { ApexStore } from './apex.store';

@Component({
  selector: 'upd-apex-donut-task-success',
  templateUrl: './apex-donut-task-success.component.html',
  styleUrls: ['./apex-donut-task-success.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ApexStore],
  standalone: false,
})
export class ApexDonutTaskSuccessComponent {
  private i18n = inject(I18nFacade);
  private readonly apexStore = inject(ApexStore);

  readonly title = input('');
  readonly titleTooltip = input('');
  readonly successRate = input<number | null | undefined>(null);
  readonly launchDate = input<Date | string | null | undefined>(null);
  readonly change = input<number | null | undefined>(null);
  readonly showChange = input(false);
  readonly colours = input<string[]>();

  readonly vm = toSignal(this.apexStore.vm$);

  readonly series = computed<ApexNonAxisChartSeries>(() => {
    const rate = this.successRate() ?? 0;
    const success = Math.round(rate * 10000) / 100;
    return [success, Math.round((100 - success) * 100) / 100];
  });

  readonly centerLabel = computed(() => {
    const rate = this.successRate();
    return rate != null ? `${Math.round(rate * 100)}%` : '';
  });

  constructor() {
    effect(() => {
      const colours = this.colours();
      if (colours) {
        this.apexStore.setColours(colours);
      }
    });

    effect(() => {
      const lang = this.i18n.currentLang();
      this.apexStore.setLocale(lang);
      this.apexStore.setLabels([
        this.i18n.service.translate('Success', lang),
        this.i18n.service.translate('Remaining', lang),
      ]);
    });
  }
}
