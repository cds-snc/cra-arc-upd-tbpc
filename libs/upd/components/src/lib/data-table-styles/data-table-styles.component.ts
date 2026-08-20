import { formatDate, formatNumber, formatPercent } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type {
  ChangeColumnConfig,
  ColumnConfig,
  ColumnConfigPipe,
  LabelValue,
  LinkColumnConfig,
} from '@dua-upd/types-common';
import { SecondsToMinutesPipe } from '@dua-upd/upd/pipes';
import { I18nFacade } from '@dua-upd/upd/state';

@Component({
  selector: 'upd-data-table-styles',
  templateUrl: './data-table-styles.component.html',
  styleUrls: ['./data-table-styles.component.scss'],
  standalone: false,
})
export class DataTableStylesComponent<ColumnRow, T> {
  private readonly secondsToMinutesPipe = inject(SecondsToMinutesPipe);
  readonly i18n = inject(I18nFacade);

  config = input.required<ColumnConfig<ColumnRow>>();
  data = input.required<T>();
  fieldData = computed(
    () =>
      (this.data() as Record<string, unknown>)[this.config().field],
  );

  isArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
  }

  stringValues(value: readonly unknown[]): string[] {
    return value.map(String);
  }

  labelValues(value: unknown): readonly LabelValue[] {
    return (Array.isArray(value) ? value : [value]) as readonly LabelValue[];
  }

  valueAt(field: string): unknown {
    return (this.data() as Record<string, unknown>)[field];
  }

  routerLink(config: LinkColumnConfig<ColumnRow>): unknown[] {
    return [config.preLink, this.valueAt(config.link), config.postLink].filter(
      (segment) => segment !== null && segment !== undefined && segment !== '',
    );
  }

  formattedValue(
    value: unknown,
    pipe: ColumnConfigPipe | undefined = this.config().pipe,
    pipeParam: string | undefined = this.config().pipeParam,
  ): unknown {
    if (value === null || value === undefined) return value;

    switch (pipe) {
      case 'number':
        return typeof value === 'number'
          ? formatNumber(value, this.currentLang, pipeParam)
          : value;
      case 'percent':
        return typeof value === 'number'
          ? formatPercent(value, this.currentLang, pipeParam)
          : value;
      case 'date':
        return formatDate(
          value as string | number | Date,
          pipeParam ?? 'yyyy-MM-dd',
          this.currentLang,
          'UTC',
        );
      case 'secondsToMinutes':
        return typeof value === 'number'
          ? this.secondsToMinutesPipe.transform(value)
          : value;
      default:
        return value;
    }
  }

  changeClasses(config: ChangeColumnConfig<ColumnRow>, value: unknown) {
    if (typeof value !== 'number' || config.colour === 'none') return {};

    const upIsGood = config.colour !== 'down-good';
    return {
      'text-danger': upIsGood ? value < 0 : value > 0,
      'text-success': upIsGood ? value > 0 : value < 0,
    };
  }

  changeIndicator(config: ChangeColumnConfig<ColumnRow>, value: unknown): string {
    if (typeof value !== 'number' || value === 0 || !config.indicator) return '';
    if (config.indicator === 'arrow') {
      return value < 0 ? 'arrow_downward' : 'arrow_upward';
    }
    return value < 0 ? '-' : '+';
  }

  changeValue(config: ChangeColumnConfig<ColumnRow>, value: unknown): unknown {
    const displayValue =
      config.indicator && typeof value === 'number' ? Math.abs(value) : value;
    return this.formattedValue(displayValue, config.pipe, config.pipeParam);
  }

  secondaryValue(config: ChangeColumnConfig<ColumnRow>): unknown {
    if (!config.secondaryField) return '';
    const value = this.valueAt(config.secondaryField.field);
    if (typeof value !== 'number') {
      return this.formattedValue(
        value,
        config.secondaryField.pipe,
        config.secondaryField.pipeParam,
      );
    }

    const sign = value === 0 ? '' : value < 0 ? '-' : '+';
    return `${sign}${this.formattedValue(
      Math.abs(value),
      config.secondaryField.pipe,
      config.secondaryField.pipeParam,
    )}`;
  }

  get currentLang() {
    return this.i18n.service.currentLang;
  }

  ensureLinkFormat(link: unknown) {
    if (Array.isArray(link)) throw new Error('Link should not be an array');
    if (
      typeof link !== 'string' ||
      link.startsWith('https://') ||
      link.startsWith('/')
    ) {
      return link;
    }
    return `https://${link}`;
  }
}
