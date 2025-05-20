import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewChild,
  effect,
  inject,
  input,
} from '@angular/core';
import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexChart,
  ApexOptions,
  ApexPlotOptions,
  ApexResponsive,
  ChartType,
} from 'ng-apexcharts';
import { formatPercent } from '@angular/common';

import { EN_CA, LocaleId } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import { defaultKpiObjectiveCriteria, defaultKpiObjectiveStatusConfig } from './kpi-objectives';
import type { ColumnConfig } from '@dua-upd/types-common';
import { KpiObjectiveStatus } from '../data-card/data-card.component';

import fr from 'apexcharts/dist/locales/fr.json';
import en from 'apexcharts/dist/locales/en.json';

@Component({
  selector: 'upd-apex-radial-bar',
  templateUrl: './apex-radial-bar.component.html',
  styleUrls: ['./apex-radial-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApexRadialBarComponent {
  private readonly i18n = inject(I18nFacade);

  @ViewChild('chart', { static: false }) chart!: ChartComponent;

  @Input() secondaryTitleCols: ColumnConfig = { field: '', header: '' };
  @Input() secondaryTitleData: Record<string, number | string>[] = [];
  @Input() title = '';
  @Input() titleTooltip = '';
  @Input() modal = '';
  @Input() keyword = 'calls';
  @Input() seriesLabel = 'visits';
  @Input() valueLabel = 0;
  @Input() preLabel = '';
  @Input() postValue = '';
  @Input() kpiObjectiveCriteria = defaultKpiObjectiveCriteria;

  current = input<number>(0);
  comparison = input<number>(0);
  comparisonMode = input<number>(0);
  labels = input<string[]>([]);

  readonly type: ChartType = 'radialBar';

  readonly chartConfig: ApexChart = {
    height: 350,
    width: 325,
    type: this.type,
    locales: [fr, en],
    defaultLocale: 'en',
  };

  chartOptions: Partial<ApexOptions> = {
    chart: this.chartConfig,
    stroke: { lineCap: 'round' },
    dataLabels: {
      enabled: true,
      formatter: (value, { seriesIndex, w }) =>
        `${w.config.series[seriesIndex]?.name || ''}: ${value}`,
    },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        offsetY: -20,
        hollow: {
          margin: 0,
          size: '70%',
        },
        dataLabels: {
          show: true,
          name: {
            show: true,
            fontSize: '18px',
            fontWeight: 'default',
            fontFamily: 'Noto Sans',
            offsetY: -5,
          },
          value: {
            offsetY: -55,
            fontSize: '32px',
            fontWeight: 'bold',
            fontFamily: 'Noto Sans',
            color: '#333',
            formatter: (val: number) => `${val}%`,
          },
        },
      },
    },
    responsive: this.getResponsiveOptions(),
  };

  constructor() {
    effect(() => {
      const curr = this.current();
      const comp = this.comparison();
      const labelList = this.labels();
      const lang = this.i18n.currentLang();
      const locale = lang === EN_CA ? 'en' : 'fr';

      const kpi: KpiObjectiveStatus = this.kpiObjectiveCriteria(curr, comp);
      const colour = defaultKpiObjectiveStatusConfig[kpi]?.colour || '#000000';

      const postValueFunction = (data: number): string => {
        const value = formatPercent(data / 100, locale);
        return this.postValue
          ? `${value} ${this.i18n.service.translate(this.postValue, `${locale}-CA` as LocaleId)}`
          : value;
      };

      const labelText =
        labelList.length === 1
          ? labelList
          : this.preLabel && this.valueLabel
            ? [
                `${this.i18n.service.translate(this.preLabel, `${locale}-CA` as LocaleId)} ${formatPercent(this.valueLabel, locale)}`,
              ]
            : comp !== 0
              ? [formatPercent(comp, locale)]
              : [''];

      this.chartOptions = {
        ...this.chartOptions,
        series: [Math.abs(curr * 100)],
        fill: { colors: [colour] },
        labels: labelText,
        plotOptions: {
          radialBar: {
            ...this.chartOptions.plotOptions?.radialBar,
            dataLabels: {
              ...this.chartOptions.plotOptions?.radialBar?.dataLabels,
              name: {
                ...this.chartOptions.plotOptions?.radialBar?.dataLabels?.name,
                color: 'black',
              },
              value: {
                ...this.chartOptions.plotOptions?.radialBar?.dataLabels?.value,
                formatter: postValueFunction,
              },
            },
          },
        },
      };
    });
  }

  get hasData(): boolean {
    const series = this.chartOptions.series;
    return Array.isArray(series) && series.every(val => typeof val === 'number' && !isNaN(val));
  }

  private getResponsiveOptions(): ApexResponsive[] {
    return [
      {
        breakpoint: 1600,
        options: { chart: { height: 300 }, plotOptions: this.resizePlotOptions('16px', '26px', -55) },
      },
      {
        breakpoint: 1400,
        options: { chart: { height: 250 }, plotOptions: this.resizePlotOptions('16px', '26px', -40) },
      },
      {
        breakpoint: 1300,
        options: { chart: { height: 200 }, plotOptions: this.resizePlotOptions('12px', '20px', -40) },
      },
      {
        breakpoint: 1100,
        options: { chart: { height: 170 }, plotOptions: this.resizePlotOptions('10px', '20px', -30) },
      },
      {
        breakpoint: 992,
        options: { chart: { height: 350 }, plotOptions: this.resizePlotOptions('18px', '28px', -55) },
      },
    ];
  }

  private resizePlotOptions(nameSize: string, valueSize: string, offsetY: number): ApexPlotOptions {
    return {
      radialBar: {
        dataLabels: {
          name: { fontSize: nameSize },
          value: { fontSize: valueSize, offsetY },
        },
      },
    };
  }
}
