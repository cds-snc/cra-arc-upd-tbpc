import {
  Component,
  computed,
  effect,
  inject,
  signal,
  Signal,
  WritableSignal,
  OnInit,
} from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import type {
  KpiObjectiveCriteria,
  KpiOptionalConfig,
  DropdownOption,
} from '@dua-upd/upd-components';
import type { ColumnConfig } from '@dua-upd/types-common';
import { PagesDetailsFacade } from '../+state/pages-details.facade';
import { formatNumber } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import dayjs from 'dayjs';
import { FR_CA } from '@dua-upd/upd/i18n';
import { isNullish } from '@dua-upd/utils-common';

@Component({
    selector: 'upd-pages-details-readability',
    templateUrl: './pages-details-readability.component.html',
    styleUrls: ['./pages-details-readability.component.css'],
    standalone: false
})
export class PagesDetailsReadabilityComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);

  url = toSignal(this.pageDetailsService.pageUrl$);

  currentLang = this.i18n.currentLang;

  pageLang = toSignal(this.pageDetailsService.pageLang$);

  // Flesch-Kincaid vs. Kandel-Moles
  readabilityDescriptionKey = computed(() => {
    const pageLang = this.pageLang();
    return pageLang === 'fr'
      ? 'calculation-of-readability-points-description-fr'
      : 'calculation-of-readability-points-description';
  });

  readabilityArray = toSignal(this.pageDetailsService.readability$);
  dropdownOptions: Signal<DropdownOption<string>[]> = computed(() => {
    const dates = this.readabilityArray();
    const currentLang = this.currentLang();

    const dateFormat = currentLang === FR_CA ? 'DD MMM YYYY' : 'MMM DD, YYYY';

    return (dates ?? []).map(({ date }) => ({
      label: dayjs(date).locale(this.currentLang()).format(dateFormat),
      value: date.toString(),
    }));
  });

  selectedDateIndex: WritableSignal<number | null> = signal(null);
  selectedDate: Signal<DropdownOption<string> | null> = computed(() => {
    const selectedDateIndex = this.selectedDateIndex();

    const options = this.dropdownOptions();

    if (options.length === 0 || !this.url()) return null;

    if (isNullish(this.selectedDateIndex()) || selectedDateIndex === -1) {
      return options[0];
    }

    return options[selectedDateIndex as number];
  });

  selectedReadability = computed(() => {
    const data = this.readabilityArray() || [];

    return data[this.selectedDateIndex() ?? 0];
  });

  readabilityStats = computed(() => {
    const selected = this.selectedReadability();

    return {
      pageLastUpdated: selected?.date || null,
      totalScore: selected?.total_score || null,
      readabilityPoints: selected?.fk_points || null,
      fleshKincaid: selected?.final_fk_score || null,
      headingPoints: selected?.header_points || null,
      wordsPerHeading: selected?.avg_words_per_header || null,
      paragraphPoints: selected?.paragraph_points || null,
      wordsPerParagraph: selected?.avg_words_per_paragraph || null,
      mostFrequentWordsOnPage: selected?.word_counts || [],
      wordCount: selected?.total_words || null,
      paragraphCount: selected?.total_paragraph || null,
      headingCount: selected?.total_headings || null,
    };
  });

  fleshKincaidFormatted = computed(() => {
    const message = this.i18n.service.translate(
      'flesch-kincaid-readability-score',
      this.currentLang(),
    );
    const value = formatNumber(
      this.readabilityStats()?.fleshKincaid ?? 0,
      this.currentLang(),
      '1.0-2',
    );

    return `${message} ${value}`;
  });

  wordsPerHeadingFormatted = computed(() => {
    const message = this.i18n.service.translate(
      'words-between-each-heading',
      this.currentLang(),
    );
    const value = formatNumber(
      this.readabilityStats()?.wordsPerHeading ?? 0,
      this.currentLang(),
      '1.0-2',
    );

    return `${message} ${value}`;
  });

  wordsPerParagraphFormatted = computed(() => {
    const message = this.i18n.service.translate(
      'words-per-paragraph',
      this.currentLang(),
    );
    const value = formatNumber(
      this.readabilityStats()?.wordsPerParagraph ?? 0,
      this.currentLang(),
      '1.0-2',
    );

    return `${message} ${value}`;
  });

  mostFrequentWordsOnPageCols: ColumnConfig<{ word: string; count: number }>[] =
    [
      {
        field: 'word',
        header: 'word',
        headerClass: 'col-3',
      },
      {
        field: 'count',
        header: 'count',
        headerClass: 'col-auto',
      },
    ];

  totalScoreTemplateParams = ['{{}}/100', '1.0-2'];
  readabilityScoreTemplateParams = ['{{}}/60', '1.0-2'];
  otherScoresTemplateParams = ['{{}}/20', '1.0-2'];

  totalScoreKpiConfig: Signal<KpiOptionalConfig> = computed(() => {
    const totalScore = this.readabilityStats()?.totalScore;

    const messageFromScore = (score: number): string => {
      if (score >= 90) return 'kpi-90-or-more';
      if (score >= 80) return 'kpi-80-and-90';
      if (score >= 70) return 'kpi-70-and-80';
      if (score >= 60) return 'kpi-60-and-70';
      if (score >= 50) return 'kpi-50-and-60';
      return 'kpi-50-or-under';
    };

    const messageFormatter = () =>
      this.i18n.service.instant(messageFromScore(totalScore ?? 0));

    return {
      pass: { messageFormatter },
      partial: { messageFormatter },
      fail: { messageFormatter },
    };
  });

  constructor() {
    effect(
      () => {
        if (!this.url()) return;

        const storedConfig = this.getStoredConfig();

        if (storedConfig) {
          this.updateSelection(storedConfig);
        }
      }
    );

    effect(() => {
      if (
        !this.selectedDate() ||
        !this.url() ||
        isNullish(this.selectedDateIndex())
      )
        return;

      sessionStorage.setItem(
        `${this.url()}-readability-config`,
        JSON.stringify(this.selectedDate()),
      );
    });
  }

  ngOnInit() {
    const storedConfig = this.getStoredConfig();

    if (storedConfig) {
      this.updateSelection(storedConfig);
    }
  }

  private getStoredConfig(): DropdownOption<string> | null {
    const currentUrl = this.url();

    return currentUrl
      ? JSON.parse(
          sessionStorage.getItem(`${currentUrl}-readability-config`) || 'null',
        )
      : null;
  }

  totalScoreKpiCriteria: KpiObjectiveCriteria = (totalScore: number) => {
    switch (true) {
      case totalScore >= 70:
        return 'pass';
      case totalScore >= 60 && totalScore < 70:
        return 'partial';
      case totalScore < 60:
        return 'fail';
      default:
        return 'none';
    }
  };

  updateSelection(option: DropdownOption<string>) {
    if (!this.url()) return;

    const dateOptionIndex = this.dropdownOptions()?.findIndex(
      (opt) => opt.value === option.value,
    );

    this.selectedDateIndex.set(dateOptionIndex);
  }
}
