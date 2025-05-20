import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexOptions,
  ChartType,
} from 'ng-apexcharts';
import { ChartComponent } from 'ng-apexcharts';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  ViewChild,
} from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA } from '@dua-upd/upd/i18n';
import type {
  KpiObjectiveStatusConfig,
  KpiOptionalConfig,
} from '../data-card/data-card.component';
import {
  defaultKpiObjectiveStatusConfig,
  defaultKpiObjectiveCriteria,
} from '../apex-radial-bar/kpi-objectives';
import fr from 'apexcharts/dist/locales/fr.json';
import en from 'apexcharts/dist/locales/en.json';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/en-ca';
import 'dayjs/locale/fr-ca';
import { mergeDeepRight } from 'rambdax';
import { sum } from '@dua-upd/utils-common';

dayjs.extend(utc);

@Component({
    selector: 'upd-apex-spark-line',
    templateUrl: './apex-spark-line.component.html',
    styleUrls: ['./apex-spark-line.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ApexSparkLineComponent {
  private readonly i18n = inject(I18nFacade);

  @ViewChild('chart', { static: false }) chart!: ChartComponent;
  @Input() secondaryTitleCols: ColumnConfig = { field: '', header: '' };
  @Input() secondaryTitleData: Record<string, number | string>[] = [];
  @Input() title = '';
  @Input() titleTooltip = '';
  @Input() current = 0;
  @Input() comparison = 0;
  @Input() labels: string[] = [''];
  @Input() seriesLabel = 'visits';
  @Input() kpiObjectiveCriteria = defaultKpiObjectiveCriteria;
  @Input() kpiStylesConfig: KpiOptionalConfig = {};
  @Input() modal = '';
  @Input() keyword = 'calls';
  @Input() series: ApexAxisChartSeries = [];
  @Input() scale = 100;
  @Input() difference = 0;
  @Input() emptyMessage = 'nodata-available';
  type: ChartType = 'line';

  get hasData() {
    return (
      sum(
        this.series
          ?.flat()
          .map(
            (series) =>
              (
                (typeof series === 'object' &&
                  'data' in series &&
                  series.data) ||
                []
              ).length,
          ) || [],
      ) > 0
    );
  }

  readonly chartConfig: ApexChart = {
    type: 'line',
    sparkline: {
      enabled: true,
    },
    height: 50,
    offsetY: 25,
    locales: [fr, en],
    defaultLocale: 'en',
  };

  chartOptions: Partial<ApexOptions> = {
    chart: this.chartConfig,
    labels: this.labels,
    stroke: {
      curve: 'smooth',
      width: 1.8,
    },
    xaxis: {
      type: 'datetime',
    },
    tooltip: {
      fixed: {
        enabled: false,
      },
      y: {
        formatter: (val: number) => {
          return val?.toLocaleString(this.i18n.service.currentLang, {
            maximumFractionDigits: 2,
          });
        },
      },
      x: {
        show: true,
        formatter: (val: number) => {
          const lang = this.i18n.service.currentLang;
          const dateFormat = lang === EN_CA ? 'MMM D' : 'D MMM';

          return dayjs
            .utc(val)
            .locale(this.i18n.service.currentLang)
            .format(dateFormat);
        },
      },
      inverseOrder: true,
    },
  };

  get kpiObjectiveStatus() {
    return (
      this.kpiObjectiveCriteria?.(this.current, this.comparison || 0) || 'none'
    );
  }

  get kpiConfig(): KpiObjectiveStatusConfig {
    return mergeDeepRight(
      defaultKpiObjectiveStatusConfig,
      this.kpiStylesConfig || {},
    );
  }

  colours = ['#DEDEDE', this.kpiConfig[this.kpiObjectiveStatus].colour];

  get colors() {
    this.colours[1] = this.kpiConfig[this.kpiObjectiveStatus].colour;

    return this.colours;
  }

  get diff() {
    return (this.difference * this.scale).toLocaleString(
      this.i18n.service.currentLang,
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      },
    );
  }

  get curr() {
    return Math.abs(this.current * this.scale).toLocaleString(
      this.i18n.service.currentLang,
      {
        maximumFractionDigits: 1,
      },
    );
  }
}
