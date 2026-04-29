import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

type PerformanceBand = 'poor' | 'low' | 'good' | 'great';
type TrendBand = 'higher' | 'normal' | 'lower';

export type ZoneRange<T extends string = string> = {
  key: T;
  name: string;
  from: number;
  to: number;
  color: string;
};

type ZoneStatusClass =
  | 'healthy'
  | 'watch'
  | 'improving'
  | 'needs-action';

type ZoneStatus = {
  labelKey: string;
  noteKey: string;
  className: ZoneStatusClass;
};

type StatusKey = `${PerformanceBand}-${TrendBand}`;

@Component({
  selector: 'upd-zone-map',
  templateUrl: './zone-map.component.html',
  styleUrls: ['./zone-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ZoneMapComponent {
  @Input() relative: PerformanceBand = 'great';
  @Input() historical: TrendBand = 'higher';

  @Input() relativeRanges: ZoneRange<PerformanceBand>[] = [];
  @Input() historicalRanges: ZoneRange<TrendBand>[] = [];

  private readonly rowOrder: PerformanceBand[] = [
    'great',
    'good',
    'low',
    'poor',
  ];

  private readonly columnOrder: TrendBand[] = [
    'higher',
    'normal',
    'lower',
  ];

  readonly legend: ZoneStatus[] = [
    {
      labelKey: 'zone-map-status-healthy',
      className: 'healthy',
      noteKey: 'task-status-note-no-action',
    },
    {
      labelKey: 'zone-map-status-watch',
      className: 'watch',
      noteKey: 'task-status-note-monitor',
    },
    {
      labelKey: 'zone-map-status-improving',
      className: 'improving',
      noteKey: 'task-status-note-progress',
    },
    {
      labelKey: 'zone-map-status-needs-action',
      className: 'needs-action',
      noteKey: 'task-status-note-prioritize',
    },
  ];

  private readonly statusMap: Record<StatusKey, ZoneStatus> = {
    'great-higher': this.legend[0],
    'great-normal': this.legend[0],
    'great-lower': this.legend[1],

    'good-higher': this.legend[0],
    'good-normal': this.legend[0],
    'good-lower': this.legend[1],

    'low-higher': this.legend[2],
    'low-normal': this.legend[1],
    'low-lower': this.legend[3],

    'poor-higher': this.legend[2],
    'poor-normal': this.legend[3],
    'poor-lower': this.legend[3],
  };

  get rows(): PerformanceBand[] {
    const available = new Set(
      this.relativeRanges.map((range) => range.key),
    );

    return this.rowOrder.filter((key) => available.has(key));
  }

  get columns(): TrendBand[] {
    const available = new Set(
      this.historicalRanges.map((range) => range.key),
    );

    return this.columnOrder.filter((key) => available.has(key));
  }

  isActive(
    row: PerformanceBand,
    column: TrendBand,
  ): boolean {
    return row === this.relative && column === this.historical;
  }

  getStatus(
    row: PerformanceBand,
    column: TrendBand,
  ): ZoneStatus {
    return this.statusMap[`${row}-${column}`] ?? this.legend[3];
  }

  getRowClass(row: PerformanceBand): string {
    return row;
  }

  getRelativeName(row: PerformanceBand): string {
    return (
      this.relativeRanges.find((range) => range.key === row)?.name ??
      row
    );
  }

  getHistoricalName(column: TrendBand): string {
    return (
      this.historicalRanges.find(
        (range) => range.key === column,
      )?.name ?? column
    );
  }

  getRelativeRangeLabel(row: PerformanceBand): string {
    const range = this.relativeRanges.find(
      (item) => item.key === row,
    );

    if (!range) {
      return '';
    }

    return this.formatPercentRange(range.from, range.to);
  }

  getHistoricalRangeLabel(column: TrendBand): string {
    if (column === 'higher') {
      return '> +5%';
    }

    if (column === 'lower') {
      return '< -5%';
    }

    return '±5%';
  }

  private formatPercentRange(
    from: number,
    to: number,
  ): string {
    const fromPercent = from <= 1 ? from * 100 : from;
    const toPercent = to <= 1 ? to * 100 : to;

    return `${Math.round(fromPercent)}–${Math.round(toPercent)}%`;
  }
}