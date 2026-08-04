import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ApexNonAxisChartSeries, ApexTooltip } from 'ng-apexcharts';
import { I18nFacade } from '@dua-upd/upd/state';
import { ApexStore } from './apex.store';
import { formatPercent } from '@angular/common';

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
  readonly pointChange = input<number | null | undefined>(null);
  readonly showChange = input(false);
  readonly colours = input<string[]>();
  readonly noDataMessage = input('nodata-available');

  readonly vm = toSignal(this.apexStore.vm$);

  readonly series = computed<ApexNonAxisChartSeries>(() => {
    const rate = this.successRate() ?? 0;
    const success = Math.round(rate * 10000) / 100;
    return [success, Math.round((100 - success) * 100) / 100];
  });

  readonly successPercent = computed(() => {
    const rate = this.successRate();
    return rate != null ? Math.round(rate * 100) : null;
  });

  readonly centerLabel = computed(() => {
    const percent = this.successPercent();
    return percent != null
      ? `${formatPercent(percent / 100, this.i18n.currentLang())}`
      : '';
  });

  readonly tooltip = computed<ApexTooltip>(() => {
    const percent = this.successPercent() ?? 0;
    return {
      enabledOnSeries: [0],
      y: {
        formatter: () =>
          `${formatPercent(percent / 100, this.i18n.currentLang())}`,
      },
    };
  });

  getArrow(value: number) {
    if (value < 0) {
      return 'arrow_downward';
    } else if (value > 0) {
      return 'arrow_upward';
    }

    return '';
  }

  getAbsChange(value: number): number {
    return Math.abs(value);
  }

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
