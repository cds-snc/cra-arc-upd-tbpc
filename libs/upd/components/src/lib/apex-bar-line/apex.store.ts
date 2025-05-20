import { inject, Injectable } from '@angular/core';
import { EN_CA } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import {
  arrayToDictionary,
  arrayToDictionaryMultiref,
  sum,
} from '@dua-upd/utils-common';
import { ComponentStore } from '@ngrx/component-store';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexOptions,
  ApexYAxis,
} from 'ng-apexcharts';
import { mergeDeepRight, pluck } from 'rambdax';
import { createBaseConfig } from '../apex-base/apex.config.base';

export type TooltipParams = {
  series: number[][];
  dataPointIndex: number;
  seriesIndex: number;
  // apex can't be bothered to type this, so we'll just use `any`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  w: { config: ApexOptions; globals: any };
};

export type SeriesDates = { x: string }[];
export type SeriesWithXYData = {
  data: { x: string; y: number }[];
  name: string;
  type: string;
};

@Injectable()
export class ApexStore extends ComponentStore<ApexOptions> {
  private i18n = inject(I18nFacade);

  constructor() {
    super(
      mergeDeepRight(
        createBaseConfig((val: number) =>
          val.toLocaleString(this.i18n.service.currentLang, {
            maximumFractionDigits: 0,
          }),
        ),
        {
          toolbar: {
            offsetY: -1,
            offsetX: -103,
            tools: {
              download:
                '<span class="material-icons align-middle">download</span>',
            },
          },
          yaxis: [],
        } as ApexOptions,
      ),
    );
  }

  readonly setColours = this.updater(
    (state, value: string[]): ApexOptions => ({
      ...state,
      colors: value ? value : [],
    }),
  );

  readonly setLocale = this.updater(
    (state, value: string): ApexOptions => ({
      ...state,
      chart: {
        ...state.chart,
        defaultLocale: value === EN_CA ? 'en' : 'fr',
      } as ApexChart,
    }),
  );

  readonly setAnnotations = this.updater(
    (state, values: { x: Date; y: number; text: string }[]): ApexOptions => {
      const annotationsByDate = arrayToDictionaryMultiref(
        values.map(({ x, y, text }) => ({
          x: x.toISOString(),
          y,
          text,
        })),
        'x',
      );

      const seriesDicts = (state.series as SeriesWithXYData[])?.map((series) =>
        arrayToDictionary(series.data, 'x'),
      );

      return {
        ...state,
        tooltip: {
          enabled: true,
          shared: true,
          intersect: false,

          custom: ({
            series,
            dataPointIndex,
            seriesIndex,
            w,
          }: TooltipParams) => {
            const { data } = <{ data: SeriesDates }>(
              w.config.series?.[seriesIndex]
            );

            const date = data[dataPointIndex].x;

            const annotation = annotationsByDate[date.toString()];

            try {
              return getTooltipHtml(
                {
                  title: formatDate(date, this.i18n.service.currentLang),
                  series: series.map((s: number[], i: number) => ({
                    label: w.globals.seriesNames[i],
                    value: seriesDicts[i]?.[date]?.y,
                    colour: w.config.colors?.[i],
                  })),
                  annotation,
                },
                this.i18n.service.currentLang,
                this.i18n.service.instant('Event'),
              );
            } catch (err) {
              console.error(err);
              return '';
            }
          },
        },
        annotations: {
          points: values.map(({ x, y, text }) => ({
            x: x.getTime(),
            y,
            marker: {
              size: 4,
              radius: 5,
              strokeWidth: 1,
            },
            label: {
              text,
              style: {
                cssClass: 'hidden',
              },
            },
          })),
        },
      };
    },
  );

  readonly setYAxis = this.updater(
    (state, series: ApexAxisChartSeries): ApexOptions => {
      const firstDataSet: number[] = [0, 1].flatMap((i: number) =>
        (series[i].data as { y: number }[]).map((data) => data.y),
      );

      const secondDataSet: number[] =
        series[0]?.data?.length <= 7
          ? [2, 3].flatMap((p: number) =>
              (series[p].data as { y: number }[]).map((d) => d.y),
            )
          : firstDataSet.map((val) => Math.round(val / 5));

      const defaultYAxisOpts: ApexYAxis = {
        min: 0,
        axisTicks: {
          show: true,
        },
        axisBorder: {
          show: true,
        },
        labels: {
          style: {
            fontSize: '14px',
          },
          formatter: (val: number) => {
            return val?.toLocaleString(this.i18n.service.currentLang, {
              maximumFractionDigits: 0,
            });
          },
        },
      };

      const seriesNames = pluck('name', series);

      const yaxis: ApexYAxis[] = [
        // visits - current
        {
          seriesName: seriesNames[0],
          title: {
            text: this.i18n.service.translate(
              'visits',
              this.i18n.service.currentLang,
            ),
            style: {
              fontSize: '16px',
            },
            offsetX: -10,
          },
          max: getMax(firstDataSet),
          tickAmount: 5,
        },
        // visits - comparison
        {
          show: false,
          seriesName: seriesNames[0],
        },
        // calls - current
        {
          title: {
            text: this.i18n.service.translate(
              'Call volume',
              this.i18n.service.currentLang,
            ),
            style: {
              fontSize: '16px',
              color: '#f37d35',
            },
            offsetX: 10,
          },
          labels: {
            style: {
              colors: ['#f37d35'],
            },
          },
          opposite: true,
          max: getMax(secondDataSet),
          seriesName: seriesNames[2],
          tickAmount: 5,
        },
        // calls - comparison
        {
          opposite: true,
          show: false,
          seriesName: seriesNames[2],
        },
      ].map(mergeDeepRight(defaultYAxisOpts));

      const chartOpts: ApexOptions = {
        series,
        yaxis,
        chart: {
          type: state.chart?.type || 'line',
          toolbar: {
            offsetX: series[0]?.data?.length > 31 ? -124 : -103,
          },
        },
        fill: {
          opacity: series[0]?.data?.length > 31 ? [1, 0.75, 1, 0.75] : 1,
        },
      };

      return mergeDeepRight(state, chartOpts);
    },
  );

  readonly vm$ = this.select(this.state$, (state) => state);

  readonly hasData$ = this.select(
    this.vm$,
    (state) =>
      sum(
        state?.series
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
      ) > 0,
  );
}

export function getMax(values: number[]): number {
  const max = Math.max(...values);

  const digits = Math.floor(Math.log10(max)) + 1;
  return Math.ceil(max / Math.pow(10, digits - 1)) * Math.pow(10, digits - 1);
}

export type TooltipSeriesConfig = {
  label: string;
  value?: number;
  colour: string;
  percent?: string;
};

export type TooltipConfig = {
  title: string;
  series: TooltipSeriesConfig[];
  annotation?: {
    text: string;
  }[];
  percent?: string;
};

export function seriesTooltipHtml(
  { label, value, colour, percent }: TooltipSeriesConfig,
  index: number,
  locale: 'en-CA' | 'fr-CA',
) {
  const percentHtml = percent ? `(${percent})` : '';
  return `

  <div
    class="apexcharts-tooltip-series-group apexcharts-active d-flex"
    style="order: ${index + 1};"
  >
    <span
      class="apexcharts-tooltip-marker"
      style="background-color: ${colour}"
    ></span>
    <div
      class="apexcharts-tooltip-text"
      style="font-family: 'Noto Sans',sans-serif; font-size: 0.7rem"
    >
      <div class="apexcharts-tooltip-y-group">
        <span class="apexcharts-tooltip-text-y-label"
          >${label}: </span
        ><span class="apexcharts-tooltip-text-y-value">${(
          value || 0
        ).toLocaleString(locale)}</span>
        <span class="apexcharts-tooltip-text-y-value">${percentHtml}</span>
      </div>
    </div>
  </div>
  `;
}

export function getTooltipHtml(
  { title, series, annotation, percent }: TooltipConfig,
  locale: 'en-CA' | 'fr-CA',
  eventText = 'Event',
) {
  const annotationHtml =
    annotation && annotation.length
      ? annotation
          .map(
            (ann) => `
      <div class="apexcharts-tooltip-series-group apexcharts-active d-flex" style="order: 99;">
        <span class="apexcharts-tooltip-marker annotation" style="border: 1px solid black; border-radius: 50%; height: 8px; width: 8px"></span>
        <div class="apexcharts-tooltip-text" style="font-family: 'Noto Sans', sans-serif; font-size: 0.7rem">
          <div class="apexcharts-tooltip-y-group">
            <span class="apexcharts-tooltip-text-y-label"><strong>${eventText}:</strong> ${ann.text}: </span>
            <span class="apexcharts-tooltip-text-y-value">${title}</span>
          </div>
        </div>
      </div>
    `,
          )
          .join('')
      : '';

  const seriesHtml = series
    .filter(
      ({ value }) => value !== null && value !== undefined && !isNaN(value),
    )
    .map((series, i) => seriesTooltipHtml(series, i, locale))
    .join('');

  const hasAnnotation = Boolean(annotationHtml);
  const annotationDivider = hasAnnotation
    ? `<hr style="order: 98;" class="my-1" />`
    : '';

  const annotationSection = hasAnnotation
    ? `${annotationDivider}${annotationHtml}`
    : '';

  return `
      <div
        class="apexcharts-tooltip-title apexcharts-active d-flex"
        style="font-family: 'Noto Sans', sans-serif; font-size: 0.8rem"
      >
        ${title}
      </div>
    
      ${seriesHtml}
    
      ${annotationSection}
    `;
}

// date formatting utils
const enFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const frFormatter = new Intl.DateTimeFormat('fr-CA', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

export function formatDate(date: Date | string | number, locale: string) {
  date = date instanceof Date ? date : new Date(date);

  return locale === EN_CA ? enFormatter.format(date) : frFormatter.format(date);
}
