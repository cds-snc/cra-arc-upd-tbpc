import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import {
  LocaleNumberPipe,
  LocalePercentPipe,
  LocaleTemplatePipe,
} from '@dua-upd/upd/pipes';

export type ComparisonStatus = 'good' | 'bad' | 'neutral' | 'none';

export interface ComparisonStyles {
  colourClass?: string;
  colour?: string;
  iconName: string;
}

export interface ComparisonConfig {
  styles: Record<string, ComparisonStyles>;
  getStyleConfig: (comparisonValue: number) => ComparisonStyles;
  mode: 'upGoodDownBad' | 'upBadDownGood';
}

export const comparisonStyling: Record<ComparisonStatus, ComparisonStyles> = {
  good: {
    colourClass: 'text-success',
    iconName: 'arrow_upward',
  },
  bad: {
    colourClass: 'text-danger',
    iconName: 'arrow_downward',
  },
  neutral: {
    colourClass: '',
    iconName: '',
  },
  none: {
    colourClass: 'hidden',
    iconName: '',
  },
};

export type KpiObjectiveStatus = 'pass' | 'fail' | 'partial' | 'none';

export type KpiObjectiveStatusConfig = Record<
  KpiObjectiveStatus,
  ComparisonStyles & KpiMessage
>;

export type KpiObjectiveCriteria = (
  current: number,
  comparison: number
) => KpiObjectiveStatus;

export type KpiMessage =
  | {
      message: string;
    }
  | {
      messageFormatter: (current: number, previous?: number | null) => string;
      message?: string;
    };

export type KpiOptionalConfig = {
  [key in KpiObjectiveStatus]?: {
    [styles in keyof ComparisonStyles & KpiMessage]: string;
  };
};

const defaultKpiObjectiveStatusConfig: KpiObjectiveStatusConfig = {
  pass: {
    colourClass: 'text-success',
    iconName: 'check_circle',
    message: 'kpi-met',
  },
  fail: {
    colourClass: 'text-danger',
    iconName: 'warning',
    message: 'kpi-not-met',
  },
  partial: {
    colourClass: 'text-semisuccess',
    iconName: 'check_circle',
    message: 'kpi-half-met',
  },
  none: {
    colourClass: 'hidden',
    iconName: '',
    message: '',
  },
};

const defaultKpiObjectiveCriteria: KpiObjectiveCriteria = (
  current,
  comparison: number
) => {
  switch (true) {
    case current < 0.8 && comparison < 0.2:
      return 'fail';
    case current < 0.8 && comparison >= 0.2:
      return 'partial';
    case current >= 0.8:
      return 'pass';
    default:
      return 'none';
  }
};

@Component({
    selector: 'upd-data-card',
    templateUrl: './data-card.component.html',
    styleUrls: ['./data-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class DataCardComponent {
  private numberPipe: LocaleNumberPipe = inject(LocaleNumberPipe);
  private percentPipe: LocalePercentPipe = inject(LocalePercentPipe);
  private templatePipe: LocaleTemplatePipe = inject(LocaleTemplatePipe);

  @Input() current: number | null = null;
  @Input() comparison?: number | null;
  @Input() comparisonValue?: number | null;
  @Input() title = '';
  @Input() tooltip = '';
  @Input() modalTitle = '';
  @Input() modal = '';
  @Input() pipe: 'percent' | 'number' | 'template' = 'number';
  @Input() pipeParams?: string | string[];
  @Input() emptyMessage = 'nodata-available';

  @Input() comparisonMode: 'upGoodDownBad' | 'upBadDownGood' = 'upGoodDownBad';
  @Input() displayComparison = true;

  @Input() kpiObjectiveCriteria = defaultKpiObjectiveCriteria;
  @Input() kpiStylesConfig: KpiOptionalConfig = {};
  @Input() displayKpis = false;

  get kpiConfig(): KpiObjectiveStatusConfig {
    const mergedConfig = { ...defaultKpiObjectiveStatusConfig };

    // merge any provided config options with defaults
    for (const key of Object.keys(
      this.kpiStylesConfig
    ) as KpiObjectiveStatus[]) {
      const config = this.kpiStylesConfig[
        key
      ] as KpiObjectiveStatusConfig[keyof KpiObjectiveStatusConfig];

      if (config && 'messageFormatter' in config) {
        config.message = (
          this.current || this.current === 0
            ? config.messageFormatter(this.current, this.comparison)
            : ''
        ) as string;
      }

      mergedConfig[key] = {
        ...mergedConfig[key],
        ...this.kpiStylesConfig[key],
      };
    }

    return mergedConfig;
  }

  get kpiObjectiveStatus() {
    return typeof this.current === 'number'
      ? this.kpiObjectiveCriteria(this.current, this.comparison || 0)
      : 'none';
  }

  get comparisonStyles() {
    if (!this.displayComparison || typeof this.comparison !== 'number') {
      return comparisonStyling.none;
    }

    if (this.comparisonMode === 'upBadDownGood') {
      // JSON stringify/parse to deep clone object
      const styling = JSON.parse(JSON.stringify(comparisonStyling));
      styling.good.iconName = 'arrow_downward';
      styling.bad.iconName = 'arrow_upward';

      switch (true) {
        case this.comparison < 0:
          return styling.good;
        case this.comparison > 0:
          return styling.bad;
        default:
          return styling.neutral;
      }
    }

    switch (true) {
      case this.comparison > 0:
        return comparisonStyling.good;
      case this.comparison < 0:
        return comparisonStyling.bad;
      default:
        return comparisonStyling.neutral;
    }
  }

  get localePipe() {
    switch (this.pipe) {
      case 'number':
        return this.numberPipe;
      case 'percent':
        return this.percentPipe;
      case 'template':
        return this.templatePipe;
      default:
        return this.numberPipe;
    }
  }

  localeTransform(value: number | null, params?: string | string[]) {
    if (Array.isArray(params)) {
      return this.localePipe.transform(value, ...params);
    }

    return this.localePipe.transform(value, params);
  }
}

export const callVolumeObjectiveCriteria: KpiObjectiveCriteria = (
  current,
  comparison: number
) => {
  switch (true) {
    case current === 0:
      return 'none';
    case comparison > -0.05:
      return 'fail';
    case comparison <= -0.05:
      return 'pass';
    default:
      return 'none';
  }
};
