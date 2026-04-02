import { Component, inject, Input, OnInit } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { formatPercent, formatNumber, formatDate } from '@angular/common';
import { PageStatus, ProjectStatus } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { SecondsToMinutesPipe } from '@dua-upd/upd/pipes';

@Component({
  selector: 'upd-data-table-styles',
  templateUrl: './data-table-styles.component.html',
  styleUrls: ['./data-table-styles.component.scss'],
  standalone: false,
})
export class DataTableStylesComponent implements OnInit {
  private secondsToMinutesPipe = inject(SecondsToMinutesPipe);
  public i18n = inject(I18nFacade);

  @Input() config: ColumnConfig = { field: '', header: '' };
  @Input() data: Record<string, number | string> = {};

  array: string[] = [];
  labelType?: 'project' | 'page';
  numberVal: number | string = 0;

  ngOnInit() {
    const data = this.data[this.config.field] as number;

    if (!data) return;

    if (this.config.pipe) {
      this.numberVal = this.applyPipe(data);
    }

    if (this.config.type === 'label') {
      if (this.config.typeParam === 'status') {
        this.labelType = 'project';
      } else if (this.config.typeParam === 'pageStatus') {
        this.labelType = 'page';
      }
    }
  }

  isArray<T>(obj: T) {
    if (Array.isArray(obj)) {
      this.array = obj;
      return true;
    }
    return false;
  }

  get projectStatus(): ProjectStatus {
    return this.data[this.config.field] as ProjectStatus;
  }

  get pageStatus(): PageStatus {
    return this.data[this.config.field] as PageStatus;
  }

  comparisonClassMap(field: string, upGoodDownBad = true, showColour = true) {
    if (!showColour) return;

    const value = this.data[field] as number;

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
    const value = this.data[field] as number;
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
    const value = this.data[field] as number;
    const sign = abs && value !== 0 ? (value < 0 ? '-' : '+') : '';
    const absValue = Math.abs(value);
    const formattedValue = this.applyPipe(absValue, pipe, pipeParam);
    return `${sign}${formattedValue}`;
  }

  applyPipe(data: number, pipe = '', pipeParam = ''): string | number {
    const effectivePipe = pipe || this.config.pipe;
    const effectivePipeParam = pipeParam || this.config.pipeParam;
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

  ensureLinkFormat(link: string | number) {
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
