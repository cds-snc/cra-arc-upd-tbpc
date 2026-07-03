import { inject, Injectable } from '@angular/core';
import { formatPercent } from '@angular/common';
import { ComponentStore } from '@ngrx/component-store';
import { I18nFacade } from '@dua-upd/upd/state';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexOptions,
  ApexYAxis,
} from 'ng-apexcharts';
import { mergeDeepRight } from 'rambdax';
import { EN_CA } from '@dua-upd/upd/i18n';
import { round, sum } from '@dua-upd/utils-common';
import { createBaseConfig } from '../apex-base/apex.config.base';
import { getTooltipHtml } from '../apex-bar-line/apex.store';

export interface ChartOptions extends ApexOptions {
  chart: ApexChart;
  yaxis?: ApexYAxis;
  added?: {
    type?: string;
    isPercent?: boolean;
    isHorizontal?: boolean;
    showStatsAnnotations?: boolean;
  };
}

@Injectable()
export class ApexStore extends ComponentStore<ChartOptions> {
  private i18n: I18nFacade = inject(I18nFacade);

  constructor() {
    super({
      ...createBaseConfig((val: number) =>
        val.toLocaleString(this.i18n.service.currentLang, {
          maximumFractionDigits: 0,
        }),
      ),
      added: {
        isPercent: false,
      },
    } as ChartOptions);
  }

  readonly setColours = this.updater(
    (state, value: string[]): ChartOptions => ({
      ...state,
      colors: value ? value : [],
    }),
  );

  readonly setSeries = this.updater(
    (state, value: ApexAxisChartSeries): ChartOptions => {
      const maxSeriesLength = Math.max(
        ...(value ?? []).map((series) => series.data?.length ?? 0),
      );

      const shouldUseLine = maxSeriesLength >= 23;
      const showStatsAnnotations = state.added?.showStatsAnnotations ?? false;
      0;
      const isPercent = state.added?.isPercent ?? false;

      const statsAnnotations = getStatsAnnotations(
        value ?? [],
        state.xaxis?.categories as string[] | string[][],
      );

      return {
        ...state,
        chart: {
          ...state.chart,
          type: shouldUseLine ? 'line' : 'bar',
        },
        series: value ?? [],
        stroke: shouldUseLine
          ? { width: [3, 3, 3, 3], curve: 'smooth' }
          : undefined,
        fill: {
          opacity: shouldUseLine ? [1, 0.8] : 1,
        },
        annotations: {
          ...state.annotations,
          points: showStatsAnnotations ? statsAnnotations.points : [],
          yaxis: showStatsAnnotations ? statsAnnotations.yaxis : [],
        },
      };
    },
  );

  readonly setHorizontal = this.updater(
    (
      state,
      value: { isHorizontal: boolean; colorDistributed: boolean },
    ): ChartOptions => {
      return {
        ...state,
        added: {
          ...state.added,
          isHorizontal: value?.isHorizontal,
        },
        plotOptions: {
          ...state.plotOptions,
          bar: {
            ...state.plotOptions?.bar,
            distributed: value?.colorDistributed,
            horizontal: value?.isHorizontal,
          },
        },
      };
    },
  );

  readonly setStacked = this.updater(
    (
      state,
      value: {
        isStacked: boolean;
        isStacked100: boolean;
        hasDataLabels: boolean;
      },
    ): ChartOptions => {
      return {
        ...state,
        chart: {
          ...state.chart,
          stacked: value?.isStacked,
          stackType: value?.isStacked100 ? '100%' : undefined,
          // update for more than 2 series
          height: 175,
        },
        dataLabels: {
          enabled: value?.hasDataLabels,
          style: {
            fontSize: '14px',
            colors: ['#fff'],
          },
          formatter: (val: string) => {
            return this.i18n.service.currentLang === EN_CA
              ? `${round(+val, 0)}%`
              : `${round(+val, 0)} %`;
          },
        },
        xaxis: {
          ...state.xaxis,
          labels: {
            ...state.xaxis?.labels,
            formatter: (val: string) => {
              return this.i18n.service.currentLang === EN_CA
                ? `${val}%`
                : `${val} %`;
            },
            show: false,
          },
          crosshairs: {
            show: false,
          },
          axisTicks: {
            show: false,
          },
          axisBorder: {
            show: false,
          },
        },
        yaxis: {
          ...state.yaxis,
          labels: {
            ...state.labels,
            show: true,
            style: {
              ...state.yaxis?.labels?.style,
              fontSize: '14px',
            },
          },
          title: {
            ...state?.yaxis?.title,
            offsetX: 0,
          },
        },
        tooltip: {
          enabled: true,
          custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const date = w.globals.labels[dataPointIndex].join(' ');
            const valuePercent = w.globals.seriesPercent.map(
              (s: { [x: string]: number }) =>
                this.i18n.service.currentLang === EN_CA
                  ? `${round(s[dataPointIndex], 0)}%`
                  : `${round(s[dataPointIndex], 0)} %`,
            );

            try {
              return getTooltipHtml(
                {
                  title: date,
                  series: series.map((s: number[], i: number) => ({
                    label: w.globals.seriesNames[i],
                    value: s[dataPointIndex],
                    colour: w.config.colors?.[i],
                    percent: valuePercent[i],
                  })),
                },
                this.i18n.service.currentLang,
              );
            } catch (err) {
              console.error(err);
              return '';
            }
          },
          style: {
            fontSize: '14px',
          },
        },
      };
    },
  );

  readonly setHeight = this.updater(
    (state, value: number): ChartOptions =>
      mergeDeepRight(state, {
        chart: {
          height: value,
        },
      }),
  );

  readonly setXAxis = this.updater(
    (state, value: string[][] | string[]): ChartOptions => {
      const showStatsAnnotations = state.added?.showStatsAnnotations ?? false;

      const statsAnnotations = getStatsAnnotations(
        (state.series ?? []) as ApexAxisChartSeries,
        value,
      );

      return mergeDeepRight(state, {
        xaxis: {
          ...state.xaxis,
          type: 'category',
          categories: value,
        },
        annotations: {
          ...state.annotations,
          points: showStatsAnnotations ? statsAnnotations.points : [],
          yaxis: showStatsAnnotations ? statsAnnotations.yaxis : [],
        },
      });
    },
  );

  readonly setXAxisTitle = this.updater(
    (state, value: string): ChartOptions => ({
      ...state,
      xaxis: {
        ...state.xaxis,
        title: {
          ...state.xaxis?.title,
          text: value,
          style: {
            ...state.xaxis?.title?.style,
            fontSize: '14px',
          },
        },
      },
    }),
  );

  readonly setYAxis = this.updater(
    (state, value: string): ChartOptions =>
      mergeDeepRight(state, {
        yaxis: {
          ...state.yaxis,
          title: {
            text: value,
          },
        },
      }),
  );

  readonly setAnnotations = this.updater(
    (state, values: { x: Date; text: string }[]): ChartOptions => ({
      ...state,
      annotations: {
        points: values.map(({ x, text }) => ({
          x: x.getTime(),
          y: 15,
          marker: {
            size: 8,
          },
          label: {
            borderColor: '#FF4560',
            text,
          },
        })),
      },
    }),
  );

  readonly setShowStatsAnnotations = this.updater(
    (state, value: boolean): ChartOptions => {
      const statsAnnotations = getStatsAnnotations(
        (state.series ?? []) as ApexAxisChartSeries,
        state.xaxis?.categories as string[] | string[][],
      );

      return {
        ...state,
        added: {
          ...state.added,
          showStatsAnnotations: value,
        },
        annotations: {
          ...state.annotations,
          points: value ? statsAnnotations.points : [],
          yaxis: value ? statsAnnotations.yaxis : [],
        },
      };
    },
  );

  readonly showPercent = this.updater(
    (
      state,
      value: {
        isPercent: boolean;
        showTitleTooltip: boolean;
        showMarker: boolean;
        shared: boolean;
        showValueLabel?: boolean;
        valueLabel?: string;
      },
    ): ChartOptions => {
      if (value?.isPercent) {
        const isHorizontal = state.added?.isHorizontal ?? false;

        let titleTooltip = (seriesName: string) => {
          return seriesName;
        };

        if (!value?.showTitleTooltip) {
          titleTooltip = () => {
            return '';
          };
        }

        const valueLabelKey = value.valueLabel ?? 'success-rate';

        const tooltipConfig = {
          ...state.tooltip,
          shared: value?.shared,
          marker: {
            show: value?.showMarker,
          },
          x: {
            show: true,
          },
          y: {
            formatter: (val: number) => {
              if (val === null || val === undefined) {
                return '-';
              }
              const formatted = formatPercent(
                val,
                this.i18n.service.currentLang,
              );
              if (!value.showValueLabel) {
                return formatted;
              }
              const label = this.i18n.service.translate(
                valueLabelKey,
                this.i18n.service.currentLang,
              );
              return `${formatted} ${label}`;
            },
            title: {
              formatter: titleTooltip,
            },
          },
        };

        if (isHorizontal) {
          return {
            ...state,
            xaxis: {
              ...state.xaxis,
              min: 0,
              max: 1,
              tickAmount: 5,
              labels: {
                ...state.xaxis?.labels,
                formatter: (val: string) => {
                  return formatPercent(+val, this.i18n.service.currentLang);
                },
              },
            },
            tooltip: tooltipConfig,
          };
        } else {
          return {
            ...state,
            added: {
              ...state.added,
              isPercent: value?.isPercent,
            },
            yaxis: {
              ...state.yaxis,
              min: 0,
              max: 1,
              tickAmount: 5,
              title: {
                ...state?.yaxis?.title,
                offsetX: 0,
              },
              labels: {
                ...state.yaxis?.labels,
                formatter: (val: number) => {
                  return formatPercent(val, this.i18n.service.currentLang);
                },
              },
            },
            tooltip: tooltipConfig,
          };
        }
      }
      return state;
    },
  );

  readonly setLocale = this.updater((state, value: string): ChartOptions => {
    const showStatsAnnotations = state.added?.showStatsAnnotations ?? false;

    const statsAnnotations = getStatsAnnotations(
      (state.series ?? []) as ApexAxisChartSeries,
      state.xaxis?.categories as string[] | string[][],
    );

    return {
      ...state,
      chart: {
        ...state.chart,
        defaultLocale: value === EN_CA ? 'en' : 'fr',
      } as ApexChart,
      annotations: {
        ...state.annotations,
        points: showStatsAnnotations ? statsAnnotations.points : [],
        yaxis: showStatsAnnotations ? statsAnnotations.yaxis : [],
      },
    };
  });

  readonly vm$ = this.select(this.state$, (state) => state);

  readonly hasData$ = this.select(
    this.vm$,
    (state) =>
      sum(
        (
          state?.series
            ?.flat()
            .filter(
              (series) =>
                typeof series === 'object' &&
                'data' in series &&
                series.data.length,
            ) as { data: number[] }[] | { data: { y: number }[] }[]
        ).flatMap((series) => {
          if (typeof series.data[0] === 'number' || series.data[0] === null) {
            return series.data as number[];
          }

          return (series.data as { y: number }[]).map((data) => data.y);
        }),
      ) > 0,
  );
}

type PointAnnotation = NonNullable<
  NonNullable<ApexOptions['annotations']>['points']
>[number];

type YAxisAnnotation = NonNullable<
  NonNullable<ApexOptions['annotations']>['yaxis']
>[number];

function getStatsAnnotations(
  series: ApexAxisChartSeries,
  categories: string[] | string[][] = [],
): {
  points: PointAnnotation[];
  yaxis: YAxisAnnotation[];
} {
  const values: { x: string | number; y: number }[] = [];

  for (const s of series) {
    const data = Array.isArray(s.data) ? s.data : [];

    data.forEach((point, index) => {
      if (typeof point === 'number' && Number.isFinite(point)) {
        const category = categories[index];

        values.push({
          x: Array.isArray(category)
            ? category.join(' ')
            : (category ?? index + 1),
          y: point,
        });
      }
    });
  }

  if (!values.length) {
    return { points: [], yaxis: [] };
  }

  const maxPoint = values.reduce((a, b) => (a.y > b.y ? a : b));
  const minPoint = values.reduce((a, b) => (a.y < b.y ? a : b));
  const avg = values.reduce((sum, item) => sum + item.y, 0) / values.length;

  return {
    points: [
      makePointAnnotation(maxPoint, '#198754', 'Max', '#fff'),
      makePointAnnotation(minPoint, '#dc3545', 'Min', '#fff'),
    ],
    yaxis: [
      {
        y: avg,
        borderColor: '#ffc107',
        borderWidth: 2,
        strokeDashArray: 4,
        label: {
          text: 'Average',
          borderColor: '#ffc107',
          style: {
            background: '#ffc107',
            color: '#000',
            fontSize: '12px',
          },
        },
      },
    ],
  };
}

function makePointAnnotation(
  point: { x: string | number | string[]; y: number },
  color: string,
  text: string,
  textColor: string,
): PointAnnotation {
  return {
    x: Array.isArray(point.x) ? point.x.join(' ') : point.x,
    y: point.y,
    marker: {
      size: 6,

      fillColor: color,
      strokeColor: color,
    },
    label: {
      text,
      borderColor: color,
      style: {
        background: color,
        color: textColor,
        fontSize: '12px',
      },
    },
  };
}
