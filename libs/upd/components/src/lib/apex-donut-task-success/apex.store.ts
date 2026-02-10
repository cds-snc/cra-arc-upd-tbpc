import { inject, Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { I18nFacade } from '@dua-upd/upd/state';
import type { ApexChart, ApexNonAxisChartSeries } from 'ng-apexcharts';
import fr from 'apexcharts/dist/locales/fr.json';
import en from 'apexcharts/dist/locales/en.json';
import { EN_CA } from '@dua-upd/upd/i18n';

export interface ChartOptions {
  chart: ApexChart;
  colors: string[];
  series: ApexNonAxisChartSeries;
  labels: string[];
  plotOptions: any;
  dataLabels: any;
  legend: any;
  stroke: any;
}

@Injectable()
export class ApexStore extends ComponentStore<ChartOptions> {
  private i18n = inject(I18nFacade);

  constructor() {
    super({
      chart: {
        height: 200,
        type: 'donut',
        locales: [fr, en],
        defaultLocale: 'en',
        toolbar: { show: false },
        sparkline: { enabled: true },
      },
      colors: ['#26A69A', '#e0e0e0'],
      series: [],
      labels: ['Success', 'Remaining'],
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: { show: false },
          },
        },
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      stroke: { width: 0 },
    });
  }

  readonly setColours = this.updater(
    (state, value: string[]): ChartOptions => ({
      ...state,
      colors: value ?? ['#26A69A', '#e0e0e0'],
    }),
  );

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
