import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { ApexOptions } from 'ng-apexcharts';
import { createBaseConfig } from '../apex-base/apex.config.base';

export type ScoreRange = {
  name: string;
  from: number;
  to: number;
  color: string;
};

const DEFAULT_RANGES: ScoreRange[] = [
  { name: 'Low', from: 0, to: 40, color: '#d93025' },
  { name: 'Medium', from: 40, to: 60, color: '#f2a93b' },
  { name: 'High', from: 60, to: 100, color: '#1f9d55' },
];

@Component({
  selector: 'upd-apex-score',
  templateUrl: './apex-score.component.html',
  styleUrls: ['./apex-score.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApexScoreComponent {
  readonly title = input('Individual Score');
  readonly badge = input<'PRIMARY' | 'SECONDARY'>('PRIMARY');
  readonly score = input(0);
  readonly ranges = input<ScoreRange[]>(DEFAULT_RANGES);

  readonly scorePercent = computed(() =>
    Math.round(this.score() * 100)
  );

  readonly currentRange = computed(() => {
    const score = this.scorePercent();

    return this.ranges().find(({ from, to }) => score >= from && score <= to);
  });

  readonly summary = computed(
    () => this.currentRange()?.name.toUpperCase() ?? '',
  );

  readonly chartOptions = computed<ApexOptions>(() => {
    const currentRange = this.currentRange();
    const score = this.scorePercent();

    const base = createBaseConfig((value: number) => `${value}%`);

    return {
      ...base,

      chart: {
        ...base.chart,
        height: 22,
        type: 'bar',
        stacked: false,
        toolbar: {
          show: false,
        },
        sparkline: {
          enabled: true,
        },
      },

      series: [
        {
          name: 'Score',
          data: [100],
        },
      ],

      colors: ['#d93025'],

      fill: {
        type: 'gradient',
        gradient: {
          type: 'horizontal',
          shadeIntensity: 0,
          gradientToColors: ['#1f9d55'],
          inverseColors: false,
          opacityFrom: 1,
          opacityTo: 1,
          stops: [0, 50, 100],
          colorStops: [
            {
              offset: 0,
              color: '#d93025',
              opacity: 1,
            },
            {
              offset: 50,
              color: '#f2a93b',
              opacity: 1,
            },
            {
              offset: 100,
              color: '#1f9d55',
              opacity: 1,
            },
          ],
        },
      },

      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '45%',
          borderRadius: 4,
        },
      },

      annotations: {
        xaxis: [],
      },

      xaxis: {
        min: 0,
        max: 100,
        labels: {
          show: false,
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
      },

      yaxis: {
        show: false,
      },

      dataLabels: {
        enabled: false,
      },

      legend: {
        show: false,
      },

      tooltip: {
        enabled: true,
        custom: () => `
        <div
          class="apexcharts-tooltip-title"
          style="
            font-family: 'Noto Sans', sans-serif;
            font-size: 0.8rem;
          "
        >
          ${this.title()}
        </div>

        <div
          class="apexcharts-tooltip-series-group apexcharts-active d-flex"
          style="order: 99"
        >
          <span
            class="apexcharts-tooltip-marker"
            style="background-color: ${currentRange?.color ?? ''}"
          ></span>

          <div
            class="apexcharts-tooltip-text"
            style="
              font-family: 'Noto Sans', sans-serif;
              font-size: 0.7rem;
            "
          >
            <div class="apexcharts-tooltip-y-group">
              <span class="apexcharts-tooltip-text-y-label">
                <strong>${currentRange?.name ?? ''}:</strong>
                ${score}%
              </span>
            </div>
          </div>
        </div>
      `,
      },

      grid: {
        show: false,
        padding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      },

      states: {
        hover: {
          filter: {
            type: 'none',
          },
        },
        active: {
          filter: {
            type: 'none',
          },
        },
      },
    };
  });
}
