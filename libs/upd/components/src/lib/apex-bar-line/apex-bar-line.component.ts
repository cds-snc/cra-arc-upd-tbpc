import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ApexAxisChartSeries, ChartComponent } from 'ng-apexcharts';
import { ColumnConfig } from '../data-table-styles/types';
import { I18nFacade } from '@dua-upd/upd/state';
import { ApexStore } from './apex.store';

@Component({
  selector: 'upd-apex-bar-line',
  templateUrl: './apex-bar-line.component.html',
  styleUrls: ['./apex-bar-line.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ApexStore],
})
export class ApexBarLineComponent<T> implements OnInit {
  @ViewChild('chart', { static: true }) chart!: ChartComponent;
  @Input() secondaryTitleCols: ColumnConfig = { field: '', header: '' };
  @Input() secondaryTitleData: Record<string, number | string>[] = [];
  @Input() title = '';
  @Input() titleTooltip = '';
  @Input() table: T[] = [];
  @Input() tableCols: ColumnConfig[] = [];

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

  constructor(
    private i18n: I18nFacade,
    private readonly apexStore: ApexStore
  ) {}

  ngOnInit(): void {
    this.i18n.currentLang$.subscribe((lang) => {
      this.apexStore.setLocale(lang);
    });
  }
}
