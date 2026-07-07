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

@Component({
  selector: 'upd-apex-score',
  templateUrl: './apex-score.component.html',
  styleUrls: ['./apex-score.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApexScoreComponent {
  readonly title = input('Individual Score');
  readonly ranges = input<ScoreRange[]>();

  readonly currentRange = computed(() => this.getCurrentRange());
  readonly score = input(0);
  readonly summary = computed(
    () => this.currentRange()?.name.toUpperCase() ?? '',
  );

  readonly scoreMultiplier = input(100);

  readonly scoreValue = computed(() => {
    const value = this.score() * this.scoreMultiplier();
    return Number.isFinite(value) ? value : 0;
  });

  readonly scorePosition = computed(() => {
    const ranges = this.getSortedRanges();

    if (!ranges.length) {
      return 0;
    }

    const domainMin = ranges[0].from;
    const domainMax = ranges[ranges.length - 1].to;
    const domainSize = domainMax - domainMin;

    if (domainSize <= 0) {
      return 0;
    }

    return this.clampPercent(
      ((this.scoreValue() - domainMin) / domainSize) * 100,
    );
  });

  readonly chartOptions = computed<ApexOptions>(() => {
    const currentRange = this.currentRange();
    const score = this.scoreValue();
    const colorStops = this.createColorStops();

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

      colors: [colorStops[0]?.color ?? ''],

      fill: {
        type: 'gradient',
        gradient: {
          type: 'horizontal',
          shadeIntensity: 0,
          inverseColors: false,
          opacityFrom: 1,
          opacityTo: 1,
          colorStops,
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
                ${score.toFixed(0)}%
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

  private getSortedRanges(): ScoreRange[] {
    return [...(this.ranges() ?? [])]
      .filter(
        ({ from, to }) =>
          Number.isFinite(from) && Number.isFinite(to) && from <= to,
      )
      .sort((left, right) => left.from - right.from);
  }

  private createColorStops(): Array<{
    offset: number;
    color: string;
    opacity: number;
  }> {
    const ranges = this.getSortedRanges();

    if (!ranges.length) {
      return [];
    }

    const domainMin = Math.min(...ranges.map(({ from }) => from));
    const domainMax = Math.max(...ranges.map(({ to }) => to));
    const domainSize = domainMax - domainMin;

    if (domainSize <= 0) {
      return [
        {
          offset: 0,
          color: ranges[0].color,
          opacity: 1,
        },
        {
          offset: 100,
          color: ranges[0].color,
          opacity: 1,
        },
      ];
    }

    const toApexOffset = (value: number): number =>
      this.clampPercent(((value - domainMin) / domainSize) * 100);

    const firstRange = ranges[0];
    const lastRange = ranges[ranges.length - 1];

    return [
      {
        offset: 0,
        color: firstRange.color,
        opacity: 1,
      },

      ...ranges.map(({ from, to, color }) => ({
        offset: toApexOffset((from + to) / 2),
        color,
        opacity: 1,
      })),

      {
        offset: 100,
        color: lastRange.color,
        opacity: 1,
      },
    ];
  }

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(value, 100));
  }

  private getCurrentRange(): ScoreRange {
    const score = this.scoreValue();

    const sortedRanges = [...(this.ranges() ?? [])].sort(
      (left, right) => left.from - right.from,
    );

    return sortedRanges.find((range, index) => {
      const isLastRange = index === sortedRanges.length - 1;

      return (
        score >= range.from &&
        (isLastRange ? score <= range.to : score < range.to)
      );
    }) ?? sortedRanges[0];
  }
}
