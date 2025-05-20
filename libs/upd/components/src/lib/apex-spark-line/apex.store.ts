import { inject, Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { I18nFacade } from '@dua-upd/upd/state';
import type {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexResponsive,
  ApexStates,
  ApexStroke,
  ApexTheme,
  ApexTitleSubtitle,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { EN_CA } from '@dua-upd/upd/i18n';
import { formatPercent } from '@angular/common';

import type {
  KpiObjectiveCriteria,
  KpiObjectiveStatus,
  KpiObjectiveStatusConfig,
  KpiOptionalConfig,
} from '../data-card/data-card.component';
import {
  defaultKpiObjectiveCriteria,
  searchKpiObjectiveCriteria,
  uxTestsKpiObjectiveCriteria,
  feedbackKpiObjectiveCriteria,
  defaultKpiObjectiveStatusConfig,
} from '../apex-radial-bar/kpi-objectives';
import { isNullish } from '@dua-upd/utils-common';

export interface ChartOptions {
  chart: ApexChart;
  annotations?: ApexAnnotations;
  colors?: string[];
  dataLabels?: ApexDataLabels;
  series?: ApexAxisChartSeries | ApexNonAxisChartSeries;
  stroke?: ApexStroke;
  labels?: string[];
  legend?: ApexLegend;
  fill?: ApexFill;
  tooltip?: ApexTooltip;
  plotOptions?: ApexPlotOptions;
  responsive?: ApexResponsive[];
  markers?: ApexMarkers;
  xaxis?: ApexXAxis;
  yaxis?: ApexYAxis | ApexYAxis[];
  grid?: ApexGrid;
  states?: ApexStates;
  title?: ApexTitleSubtitle;
  subtitle?: ApexTitleSubtitle;
  theme?: ApexTheme;
}

@Injectable()
export class ApexStore extends ComponentStore<ChartOptions> {
  private i18n = inject(I18nFacade);

  constructor() {
    super({
      chart: {
        height: 350,
        type: 'radialBar',
        offsetY: -20,
        sparkline: { enabled: true },
      },
      stroke: {
        lineCap: 'round',
        width: 0.5,
      },
      dataLabels: {
        enabled: true,
      },
      plotOptions: {
        radialBar: {
          startAngle: -90,
          endAngle: 90,
          hollow: {
            margin: 0,
            size: '70%',
          },
          dataLabels: {
            show: true,
            name: {
              show: true,
              fontSize: '18px',
            },
            value: {
              offsetY: -40,
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#333',
              formatter: (val: number) => {
                return formatPercent(val / 100, this.i18n.service.currentLang);
              },
            },
          },
        },
      },
    });
  }

  readonly getCurrent = this.select((state) => state.series);

  readonly setColours = this.updater(
    (state, value: string[]): ChartOptions => ({
      ...state,
      colors: value ? value : [],
    }),
  );

  readonly setCurrent = this.updater((state, value: number): ChartOptions => {
    return {
      ...state,
      series: !isNullish(value) ? [Math.abs(value) * 100] : [],
    };
  });

  readonly setComparison = this.updater(
    (state, value: number): ChartOptions => {
      const comparison = formatPercent(value, this.i18n.service.currentLang);

      return {
        ...state,
        fill: { colors: ['#000'] },
        labels: value !== 0 ? [comparison] : [],
      };
    },
  );

  readonly setKpi = this.effect(
    (
      kpi$: Observable<{
        kpi: KpiObjectiveCriteria;
        current: number;
        comparison: number;
      }>,
    ) => {
      return kpi$.pipe(
        tap(({ kpi, current, comparison }) => {
          let colour = '#000000';
          colour =
            defaultKpiObjectiveStatusConfig[kpi(current, comparison)].colour ||
            '';

          this.setComparison(comparison);
        }),
      );
    },
  );

  readonly current$ = this.select(({ series }) => series?.flat() as number[]);

  readonly comparison$ = this.select(({ labels }) => labels);

  readonly setLocale = this.updater(
    (state, value: string): ChartOptions => ({
      ...state,
      chart: {
        ...state.chart,
        defaultLocale: value === EN_CA ? 'en' : 'fr',
      },
    }),
  );

  readonly vm$ = this.select(this.state$, (state) => state);
}
