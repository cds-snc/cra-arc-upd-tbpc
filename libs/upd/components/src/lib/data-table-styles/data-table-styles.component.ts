import { Component, computed, inject, input } from '@angular/core';
import { formatPercent, formatNumber, formatDate } from '@angular/common';
import { I18nFacade } from '@dua-upd/upd/state';
import { SecondsToMinutesPipe } from '@dua-upd/upd/pipes';
import type { ColumnConfig } from '@dua-upd/types-common';

@Component({
  selector: 'upd-data-table-styles',
  templateUrl: './data-table-styles.component.html',
  styleUrls: ['./data-table-styles.component.scss'],
  standalone: false,
})
export class DataTableStylesComponent<
  T extends Record<string, unknown>,
  ColName extends keyof T,
  ColT extends T[ColName] = T[ColName],
> {
  private secondsToMinutesPipe = inject(SecondsToMinutesPipe);
  public i18n = inject(I18nFacade);

  colConfig = input.required<ColumnConfig<T>>({ alias: 'config' });
  data = input.required<T>();
  fieldData = computed(() => this.data()[this.colConfig().field]);

  numberVal = computed<number | string>(() => {
    const data = this.fieldData();

    if (this.colConfig().pipe && typeof data === 'number') {
      return this.applyPipe(data);
    }

    return data;
  });

  isArray<T>(obj: T): obj is T & string[] {
    return Array.isArray(obj);
  }

  comparisonClassMap(field: string, upGoodDownBad = true, showColour = true) {
    if (!showColour) return;

    const value = this.data()[field] as number;

    if (upGoodDownBad) {
      return {
        'text-danger': value < 0,
        'text-success': value > 0,
      };
    }

    return {
      'text-danger': value > 0,
      'text-success': value < 0,
    };
  }

  getIndicator(field: string, arrows = true) {
    const value = this.data()[field] as number;
    if (arrows) return this.getArrow(value);
    return this.getSignedNumbers(value);
  }

  getSignedNumbers(value: number) {
    if (value < 0) {
      return '-';
    } else if (value > 0) {
      return '+';
    }

    return '';
  }

  getArrow(value: number) {
    if (value < 0) {
      return 'arrow_downward';
    } else if (value > 0) {
      return 'arrow_upward';
    }

    return '';
  }

  getValueIndicator(
    field: string,
    pipe = '',
    pipeParam = '',
    abs = true,
  ): string {
    const value = this.data()[field] as number;
    const sign = abs && value !== 0 ? (value < 0 ? '-' : '+') : '';
    const absValue = Math.abs(value);
    const formattedValue = this.applyPipe(absValue, pipe, pipeParam);
    return `${sign}${formattedValue}`;
  }

  applyPipe(data: number, pipe = '', pipeParam = ''): string | number {
    const effectivePipe = pipe || this.colConfig().pipe;
    const effectivePipeParam = pipeParam || this.colConfig().pipeParam;
    switch (effectivePipe) {
      case 'number':
        return formatNumber(data, this.currentLang, effectivePipeParam) || '';
      case 'percent':
        return formatPercent(data, this.currentLang, effectivePipeParam) || '';
      case 'date':
        return (
          formatDate(
            data,
            effectivePipeParam ?? 'yyyy-MM-dd',
            this.currentLang,
            'UTC',
          ) || ''
        );
      case 'secondsToMinutes':
        return this.secondsToMinutesPipe.transform(data) || '';
      default:
        return data;
    }
  }

  get currentLang() {
    return this.i18n.service.currentLang;
  }

  ensureLinkFormat(link: string | number | string[]) {
    if (Array.isArray(link)) {
      throw new Error('Link should not be an array');
    }

    if (
      typeof link !== 'string' ||
      link.startsWith('https://') ||
      link.startsWith('/')
    ) {
      return link;
    }

    return link.replace(/^(?!https:\/\/)/, 'https://');
  }
}
