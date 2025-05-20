import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { type ApexAxisChartSeries, ChartComponent } from 'ng-apexcharts';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { ApexStore } from './apex.store';

@Component({
    selector: 'upd-apex-bar',
    templateUrl: './apex-bar.component.html',
    styleUrls: ['./apex-bar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ApexStore],
    standalone: false
})
export class ApexBarComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly apexStore = inject(ApexStore);

  @ViewChild('chart', { static: true }) chart!: ChartComponent;
  @Input() secondaryTitleCols: ColumnConfig = { field: '', header: '' };
  @Input() secondaryTitleData: Record<string, number | string>[] = [];
  @Input() title = '';
  @Input() titleTooltip = '';
  @Input() table: any;
  @Input() tableCols: ColumnConfig[] = [];
  @Input() tableExport = true;
  @Input() allowHeaderWrap = false;
  @Input() emptyMessage = 'nodata-available';

  @Input() set showPercent(value: {
    isPercent: boolean;
    showTitleTooltip: boolean;
    showMarker: boolean;
    shared: boolean;
  }) {
    this.apexStore.showPercent(value);
  }
  @Input() set colours(value: string[]) {
    this.apexStore.setColours(value);
  }

  @Input() set series(value: ApexAxisChartSeries) {
    this.apexStore.setSeries(value);
  }

  @Input() set height(value: number) {
    this.apexStore.setHeight(value);
  }

  @Input() set xAxis(value: string[][] | string[]) {
    this.apexStore.setXAxis(value);
  }

  @Input() set yAxis(value: string) {
    this.apexStore.setYAxis(value);
  }

  @Input() set horizontal(value: {
    isHorizontal: boolean;
    colorDistributed: boolean;
  }) {
    this.apexStore.setHorizontal(value);
  }

  @Input() set stacked(value: {
    isStacked: boolean;
    isStacked100: boolean;
    hasDataLabels: boolean;
  }) {
    this.apexStore.setStacked(value);
  }

  @Input() set annotations(values: { x: Date; text: string }[]) {
    this.apexStore.setAnnotations(values);
  }

  readonly vm$ = this.apexStore.vm$;
  readonly hasData$ = this.apexStore.hasData$;

  ngOnInit(): void {
    this.i18n.currentLang$.subscribe((lang) => {
      this.apexStore.setLocale(lang);
    });
  }
}
