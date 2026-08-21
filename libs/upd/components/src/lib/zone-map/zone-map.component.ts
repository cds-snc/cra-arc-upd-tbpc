import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
} from '@angular/core';

import type {
  PerformanceBand,
  TrendBand,
} from '../task-status/task-status.component';
import { I18nFacade } from '@dua-upd/upd/state';
export type ZoneRange<T extends string = string> = {
  key: T;
  name: string;
  from: number;
  to: number;
  color: string;
};

type ZoneStatusClass = 'healthy' | 'watch' | 'needs-action';

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
  private i18n = inject(I18nFacade);
  readonly currentLang = this.i18n.currentLang;
  @Input() relative: PerformanceBand = 'strong';
  @Input() historical: TrendBand = 'improving';

  @Input() relativeRanges: ZoneRange<PerformanceBand>[] = [];
  @Input() historicalRanges: ZoneRange<TrendBand>[] = [];

  @Input() highlightActive = true;

  private readonly rowOrder: PerformanceBand[] = [
    'strong',
    'good',
    'fair',
    'poor',
  ];

  private readonly columnOrder: TrendBand[] = [
    'improving',
    'steady',
    'declining',
  ];

  private readonly statusMap: Record<StatusKey, ZoneStatus> = {
    'strong-improving': {
      labelKey: 'zone-map-status-healthy',
      noteKey: 'zone-map-note-strong-improving',
      className: 'healthy',
    },

    'strong-steady': {
      labelKey: 'zone-map-status-healthy',
      noteKey: 'zone-map-note-strong-steady',
      className: 'healthy',
    },

    'strong-declining': {
      labelKey: 'zone-map-status-watch',
      noteKey: 'zone-map-note-strong-declining',
      className: 'watch',
    },

    'good-improving': {
      labelKey: 'zone-map-status-healthy',
      noteKey: 'zone-map-note-good-improving',
      className: 'healthy',
    },

    'good-steady': {
      labelKey: 'zone-map-status-healthy',
      noteKey: 'zone-map-note-good-steady',
      className: 'healthy',
    },

    'good-declining': {
      labelKey: 'zone-map-status-watch',
      noteKey: 'zone-map-note-good-declining',
      className: 'watch',
    },

    'fair-improving': {
      labelKey: 'zone-map-status-watch',
      noteKey: 'zone-map-note-fair-improving',
      className: 'watch',
    },

    'fair-steady': {
      labelKey: 'zone-map-status-watch',
      noteKey: 'zone-map-note-fair-steady',
      className: 'watch',
    },

    'fair-declining': {
      labelKey: 'zone-map-status-needs-action',
      noteKey: 'zone-map-note-fair-declining',
      className: 'needs-action',
    },

    'poor-improving': {
      labelKey: 'zone-map-status-watch',
      noteKey: 'zone-map-note-poor-improving',
      className: 'watch',
    },

    'poor-steady': {
      labelKey: 'zone-map-status-needs-action',
      noteKey: 'zone-map-note-poor-steady',
      className: 'needs-action',
    },

    'poor-declining': {
      labelKey: 'zone-map-status-needs-action',
      noteKey: 'zone-map-note-poor-declining',
      className: 'needs-action',
    },
  };

  get rows(): PerformanceBand[] {
    const available = new Set(this.relativeRanges.map((range) => range.key));

    return this.rowOrder.filter((key) => available.has(key));
  }

  get columns(): TrendBand[] {
    const available = new Set(this.historicalRanges.map((range) => range.key));

    return this.columnOrder.filter((key) => available.has(key));
  }

  isActive(row: PerformanceBand, column: TrendBand): boolean {
    return (
      this.highlightActive &&
      row === this.relative &&
      column === this.historical
    );
  }

  getStatus(row: PerformanceBand, column: TrendBand): ZoneStatus {
    return this.statusMap[`${row}-${column}`];
  }

  getRowClass(row: PerformanceBand): string {
    return row;
  }

  getRelativeName(row: PerformanceBand): string {
    return this.relativeRanges.find((range) => range.key === row)?.name ?? row;
  }

  getHistoricalName(column: TrendBand): string {
    return (
      this.historicalRanges.find((range) => range.key === column)?.name ??
      column
    );
  }

  getRelativeRangeLabel(row: PerformanceBand): string {
    const range = this.relativeRanges.find((item) => item.key === row);

    if (!range) {
      return '';
    }

    return this.formatPercentRange(range.from, range.to);
  }

  getHistoricalArrow(column: TrendBand): string {
    switch (column) {
      case 'improving':
        return '↑';

      case 'declining':
        return '↓';

      default:
        return '→';
    }
  }

  getHistoricalRangeLabelKey(column: TrendBand): string {
    switch (column) {
      case 'improving':
        return 'zone-map-range-improving';

      case 'declining':
        return 'zone-map-range-declining';

      default:
        return 'zone-map-range-steady';
    }
  }

  private formatPercentRange(from: number, to: number): string {
    const percent = new Intl.NumberFormat(this.currentLang(), {
      style: 'percent',
      maximumFractionDigits: 0,
    });

    const normalize = (value: number) => (value <= 1 ? value : value / 100);

    return `${percent.format(normalize(from))}–${percent.format(normalize(to))}`;
  }
}
