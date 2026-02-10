import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import type { ApexNonAxisChartSeries } from 'ng-apexcharts';
import { ChartComponent } from 'ng-apexcharts';
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
export class ApexDonutTaskSuccessComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly apexStore = inject(ApexStore);

  @ViewChild('chart', { static: true }) chart!: ChartComponent;

  @Input() successRate: number | null | undefined = null;
  @Input() launchDate: Date | string | null | undefined = null;
  @Input() change: number | null | undefined = null;
  @Input() showChange = false;

  @Input() set colours(value: string[]) {
    this.apexStore.setColours(value);
  }

  readonly vm$ = this.apexStore.vm$;

  get series(): ApexNonAxisChartSeries {
    const rate = this.successRate ?? 0;
    return [rate * 100, 100 - rate * 100];
  }

  get centerLabel(): string {
    return this.successRate != null
      ? `${Math.round(this.successRate * 100)}%`
      : '';
  }

  ngOnInit(): void {
    this.i18n.currentLang$.subscribe((lang) => {
      this.apexStore.setLocale(lang);
    });
  }
}
