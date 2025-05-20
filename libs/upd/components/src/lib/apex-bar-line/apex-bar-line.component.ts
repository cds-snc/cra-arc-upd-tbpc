import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  type OnInit,
  ViewChild,
} from '@angular/core';
import type { ApexAxisChartSeries, ChartComponent } from 'ng-apexcharts';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { ApexStore } from './apex.store';

@Component({
    selector: 'upd-apex-bar-line',
    templateUrl: './apex-bar-line.component.html',
    styleUrls: ['./apex-bar-line.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ApexStore],
    standalone: false
})
export class ApexBarLineComponent<T> implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly apexStore = inject(ApexStore);

  @ViewChild('chart', { static: true }) chart!: ChartComponent;
  @Input() secondaryTitleCols: ColumnConfig = { field: '', header: '' };
  @Input() secondaryTitleData: Record<string, number | string>[] = [];
  @Input() title = '';
  @Input() titleTooltip = '';
  @Input() table: T[] = [];
  @Input() tableCols: ColumnConfig[] = [];
  @Input() allowHeaderWrap = false;

  @Input() set colours(value: string[]) {
    this.apexStore.setColours(value);
  }

  @Input() set series(value: ApexAxisChartSeries) {
    this.apexStore.setYAxis(value);
  }

  @Input() set annotations(values: { x: Date; y: number; text: string }[]) {
    this.apexStore.setAnnotations(values);
  }

  vm$ = this.apexStore.vm$;

  hasData$ = this.apexStore.hasData$;

  ngOnInit(): void {
    this.i18n.currentLang$.subscribe((lang) => {
      this.apexStore.setLocale(lang);
    });
  }
}
