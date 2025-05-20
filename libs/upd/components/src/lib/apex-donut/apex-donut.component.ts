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
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { ApexStore } from './apex.store';

@Component({
    selector: 'upd-apex-donut',
    templateUrl: './apex-donut.component.html',
    styleUrls: ['./apex-donut.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ApexStore],
    standalone: false
})
export class ApexDonutComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly apexStore = inject(ApexStore);

  @ViewChild('chart', { static: true }) chart!: ChartComponent;
  @Input() secondaryTitleCols: ColumnConfig = { field: '', header: '' };
  @Input() secondaryTitleData: Record<string, number | string>[] = [];
  @Input() title = '';
  @Input() titleTooltip = '';
  @Input() table: any;
  @Input() tableCols: ColumnConfig[] = [];

  @Input() set colours(value: string[]) {
    this.apexStore.setColours(value);
  }

  @Input() set series(value: ApexNonAxisChartSeries) {
    this.apexStore.setSeries(value);
  }

  @Input() set labels(value: string[]) {
    this.apexStore.setLabels(value);
  }

  readonly vm$ = this.apexStore.vm$;

  ngOnInit(): void {
    this.i18n.currentLang$.subscribe((lang) => {
      this.apexStore.setLocale(lang);
    });
  }
}
