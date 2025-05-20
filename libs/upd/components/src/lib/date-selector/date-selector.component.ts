import { Component, inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { DateSelectionFacade } from '@dua-upd/upd/state';
import type { LocaleId } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import { dateRangeConfigs, dayjs, DateRangeType } from '@dua-upd/utils-common';

export type DateRangeOption = {
  value: DateRangeType;
  label: string;
};

@Component({
    selector: 'upd-date-selector',
    template: `
    <div class="row mb-4 mt-1 d-block">
      <upd-dropdown
        id="range-button"
        icon="calendar_today"
        [initialSelection]="selectedPeriod | async"
        [options]="selectionOptions"
        (selectOption)="selectPeriod($event.value)"
      ></upd-dropdown>

      <span class="text-secondary ps-3 pe-2 text-nowrap dates-header-week">
        <strong>{{ displayFormatDateRange$ | async }}</strong>
      </span>
      <span
        class="text-secondary ps-0 pe-0 text-nowrap dates-header-week"
        data-i18n="compared_to"
        translate="compared_to"
      >
      </span>
      <span class="text-secondary ps-2 pe-0 text-nowrap dates-header-week">
        <strong>{{ displayFormatComparisonDateRange$ | async }}</strong>
      </span>
    </div>
  `,
    styleUrls: ['./date-selector.component.css'],
    standalone: false
})
export class DateSelectorComponent {
  private i18n: I18nFacade = inject(I18nFacade);
  private selectorService: DateSelectionFacade = inject(DateSelectionFacade);

  selectedPeriod = this.selectorService.dateSelection$.pipe(
    map(
      (dateRange) =>
        ({
          value: dateRange.type,
          label: dateRange.label,
        }) as DateRangeOption,
    ),
  );

  periodSelectionLabel$ = this.selectorService.periodSelectionLabel$;

  displayFormatDateRanges$ = combineLatest([
    this.selectorService.dateRanges$,
    this.i18n.currentLang$,
  ]).pipe(
    map(([{ dateRange, comparisonDateRange }, lang]) => ({
      dateRange: dateRangeToDisplayFormat(dateRange, lang),
      comparisonDateRange: dateRangeToDisplayFormat(comparisonDateRange, lang),
    })),
  );

  displayFormatDateRange$ = this.displayFormatDateRanges$.pipe(
    map(({ dateRange }) => dateRange),
  );

  displayFormatComparisonDateRange$ = this.displayFormatDateRanges$.pipe(
    map(({ comparisonDateRange }) => comparisonDateRange),
  );

  selectionOptions = dateRangeConfigs.map(
    (config) =>
      ({
        value: config.type,
        label: config.label,
      }) as DateRangeOption,
  );

  selectPeriod(period: DateRangeType | null) {
    if (!period) return;

    this.selectorService.selectDatePeriod(period);
  }
}

export const dateRangeToDisplayFormat = (date: string, lang: LocaleId) =>
  date
    .split('/')
    .map(
      (d) =>
        dayjs(d)
          .locale(lang)
          .format(lang === 'en-CA' ? 'MMM DD YYYY' : 'DD MMM YYYY'), // only add year to end date
    )
    .join(' - ');
