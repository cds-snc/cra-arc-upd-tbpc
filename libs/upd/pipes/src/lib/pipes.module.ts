import { inject, NgModule, Pipe, PipeTransform } from '@angular/core';
import { formatNumber, formatDate, formatPercent } from '@angular/common';
import { I18nModule, I18nService, type LocaleId } from '@dua-upd/upd/i18n';

@Pipe({
  name: 'localeNumber',
  pure: false,
  standalone: false,
})
export class LocaleNumberPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(value?: number | null, digitsInfo?: string) {
    return typeof value === 'number'
      ? formatNumber(value, this.i18n.currentLang, digitsInfo)
      : value;
  }
}

@Pipe({
  name: 'localeDate',
  pure: false,
  standalone: false,
})
export class LocaleDatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(
    value?: string | Date | null,
    format = 'mediumDate',
    lang?: LocaleId,
  ) {
    return value instanceof Date || typeof value === 'string'
      ? formatDate(value, format, lang ?? this.i18n.currentLang, 'UTC')
      : value;
  }
}

@Pipe({
  name: 'localePercent',
  pure: false,
  standalone: false,
})
export class LocalePercentPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(value?: number | null, digitsInfo?: string) {
    return typeof value === 'number'
      ? formatPercent(value, this.i18n.currentLang, digitsInfo)
      : value;
  }
}

@Pipe({
  name: 'localeTemplate',
  pure: false,
  standalone: false,
})
export class LocaleTemplatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(
    value?: number | number[] | null,
    template = '{{}}',
    digitsInfo?: string,
  ) {
    if (!value) return value;

    if (Array.isArray(value)) {
      let output = `${template}`;

      for (const val of value) {
        const formattedValue = formatNumber(
          val,
          this.i18n.currentLang,
          digitsInfo,
        );

        output = output.replace('{{}}', formattedValue);
      }

      return output;
    }

    const formattedValue = formatNumber(
      value,
      this.i18n.currentLang,
      digitsInfo,
    );

    return template.replace('{{}}', formattedValue);
  }
}

@Pipe({
  name: 'translateArray',
  pure: true,
  standalone: false,
})
export class TranslateArrayPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(values: string[]): string[] {
    return values.map((value) =>
      this.i18n.translate(value, this.i18n.currentLang),
    );
  }
}

@Pipe({
  name: 'arrayToText',
  pure: true,
  standalone: false,
})
export class ArrayToTextPipe implements PipeTransform {
  transform(values: string[]): string {
    return values.join(', ');
  }
}

@Pipe({
  name: 'truncate',
  pure: true,
  standalone: false,
})
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 160): string {
    if (value.length > limit) {
      return value.substring(0, limit) + '...';
    }
    return value;
  }
}

@Pipe({
  name: 'secondsToMinutes',
  pure: true,
  standalone: false,
})
export class SecondsToMinutesPipe implements PipeTransform {
  transform(value?: number | null): string | number | null | undefined {
    return typeof value === 'number'
      ? (() => {
          const total = Math.round(value);
          const minutes = Math.floor(total / 60);
          const seconds = total % 60;

          return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
        })()
      : value;
  }
}

@Pipe({
  name: 'ordinal',
  pure: true,
  standalone: false,
})
export class OrdinalPipe implements PipeTransform {
  transform(value?: number | null, lang?: LocaleId): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '';
    }

    const number = Math.trunc(value);
    const absoluteNumber = Math.abs(number);

    if (lang === 'fr-CA') {
      return `${number}${absoluteNumber === 1 ? 'er' : 'e'}`;
    }

    const lastTwoDigits = absoluteNumber % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return `${number}th`;
    }

    const suffix =
      {
        1: 'st',
        2: 'nd',
        3: 'rd',
      }[absoluteNumber % 10] ?? 'th';

    return `${number}${suffix}`;
  }
}

@NgModule({
  imports: [I18nModule],
  declarations: [
    LocaleNumberPipe,
    LocaleDatePipe,
    LocalePercentPipe,
    LocaleTemplatePipe,
    TranslateArrayPipe,
    ArrayToTextPipe,
    TruncatePipe,
    SecondsToMinutesPipe,
    OrdinalPipe,
  ],
  providers: [
    LocaleNumberPipe,
    LocaleDatePipe,
    LocalePercentPipe,
    LocaleTemplatePipe,
    TranslateArrayPipe,
    ArrayToTextPipe,
    TruncatePipe,
    SecondsToMinutesPipe,
    OrdinalPipe,
  ],
  exports: [
    LocaleNumberPipe,
    LocaleDatePipe,
    LocalePercentPipe,
    LocaleTemplatePipe,
    TranslateArrayPipe,
    ArrayToTextPipe,
    TruncatePipe,
    SecondsToMinutesPipe,
    OrdinalPipe,
  ],
})
export class PipesModule {}
