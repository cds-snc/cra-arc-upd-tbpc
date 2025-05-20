import { formatPercent, formatDate } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { EN_CA } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import { combineLatest, map, of } from 'rxjs';

@Component({
    selector: 'upd-data-kpi-card',
    templateUrl: './data-kpi-card.component.html',
    styleUrls: ['./data-kpi-card.component.scss'],
    standalone: false
})
export class DataKpiCardComponent implements OnInit, OnChanges {
  private i18n = inject(I18nFacade);

  @Input() current: string | number = '';
  @Input() comparison$ = of(0);
  @Input() date$ = of(new Date(0));
  @Input() difference$ = of(0);
  @Input() numUxTests = 0;
  @Input() title = '';
  @Input() tooltip = '';
  @Input() project = false;
  @Input() type = '';

  EN_CA = EN_CA;
  currentLang$ = this.i18n.currentLang$;

  comparisonFormatted$ = combineLatest([
    this.currentLang$,
    this.comparison$,
  ]).pipe(map(([lang, comparison]) => formatPercent(comparison, lang)));

  differenceFormatted$ = combineLatest([
    this.currentLang$,
    this.difference$,
  ]).pipe(map(([lang, difference]) => formatPercent(difference, lang)));

  dateFormatted$ = combineLatest([this.currentLang$, this.date$]).pipe(
    map(([lang, date]) => formatDate(date, 'mediumDate', lang)),
  );

  comparisonClass = 'hidden';
  comparisonIcon = '';

  differenceClass = 'hidden';
  differenceArrow = '';
  kpi = '';

  ngOnInit(): void {
    this.comparison$.subscribe((comparison) => {
      if (comparison < 0.8) {
        this.comparisonClass = 'text-danger';
        this.comparisonIcon = 'warning';
        this.kpi = 'kpi-not-met';
      } else if (comparison >= 0.8) {
        this.comparisonClass = 'text-success';
        this.comparisonIcon = 'check_circle';
        this.kpi = 'kpi-met';
      } else {
        this.comparisonClass = 'hidden';
        this.comparisonIcon = '';
      }
    });

    if (this.type === 'volume') {
      this.difference$.subscribe((difference) => {
        if (difference <= -0.05) {
          this.differenceClass = 'text-success';
          this.differenceArrow = 'arrow_downward';
          this.comparisonClass = 'text-success';
          this.comparisonIcon = 'check_circle';
          this.kpi = 'kpi-met-volume';
        } else if (difference > -0.05) {
          this.differenceClass = 'text-danger';
          this.differenceArrow =
            difference > 0 ? 'arrow_upward' : 'arrow_downward';
          this.comparisonClass = 'text-danger';
          this.comparisonIcon = 'warning';
          this.kpi = 'kpi-not-met-volume';
        } else {
          this.differenceClass = 'hidden';
          this.differenceArrow = '';
          this.comparisonClass = 'hidden';
          this.comparisonIcon = '';
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.type === 'volume') {
      if (changes['comparison$']) {
        this.comparisonFormatted$ = combineLatest([
          this.currentLang$,
          this.comparison$,
        ]).pipe(map(([lang, comparison]) => comparison.toLocaleString(lang)));
      }

      if (changes['difference$']) {
        this.differenceFormatted$ = combineLatest([
          this.currentLang$,
          this.difference$,
        ]).pipe(
          map(([lang, difference]) =>
            formatPercent(Math.abs(difference), lang),
          ),
        );
      }
    } else {
      if (changes['comparison$']) {
        this.comparisonFormatted$ = combineLatest([
          this.currentLang$,
          this.comparison$,
        ]).pipe(
          map(([lang, comparison]) =>
            formatPercent(Math.abs(comparison), lang),
          ),
        );
      }
    }

    if (changes['date$']) {
      this.dateFormatted$ = combineLatest([this.currentLang$, this.date$]).pipe(
        map(([lang, date]) => formatDate(date, 'mediumDate', lang, '+0')),
      );
    }
  }
}
