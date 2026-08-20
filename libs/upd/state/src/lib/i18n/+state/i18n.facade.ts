import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { computed, inject, Injectable, Signal } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { EN_CA, FR_CA, I18nService, type LocaleId } from '@dua-upd/upd/i18n';
import { Store } from '@ngrx/store';
import { init, setLang } from './i18n.actions';
import { I18nState } from './i18n.reducer';
import { selectCurrentLang } from './i18n.selectors';

@Injectable()
export class I18nFacade {
  private readonly store = inject(Store);
  private readonly i18nService = inject(I18nService);

  currentLang$ = this.store.select(selectCurrentLang);

  currentLang = this.store.selectSignal(
    ({ i18n: { currentLang } }: { i18n: I18nState }) => currentLang,
  );

  init() {
    registerLocaleData(localeFr);
    this.store.dispatch(init());
  }

  setLang(lang: LocaleId) {
    this.i18nService.use(lang);
    this.store.dispatch(setLang({ lang }));
  }

  get service() {
    return this.i18nService;
  }

  /**
   * Returns a signal that emits the table data with translated text
   * @param data The table data to translate
   * @param config The column config
   */
  toTranslatedTable<T extends object, ColumnRow extends object>(
    data: Signal<T[] | null>,
    config: Signal<ColumnConfig<ColumnRow>[]>,
  ) {
    const colsToTranslate = computed(() =>
      config()
        .filter((col) => col.translate)
        .map((col) => col.field),
    );

    const translatedCols = computed(() => {
      const inputData = data();
      const colKeys = colsToTranslate();

      if (!inputData?.length) {
        return null;
      }

      const translatedCols = {
        'en-CA': Array(inputData.length),
        'fr-CA': Array(inputData.length),
      };

      for (const [i, row] of inputData.entries()) {
        translatedCols[EN_CA][i] = {};
        translatedCols[FR_CA][i] = {};

        for (const col of colKeys) {
          const colValue = (row as Record<string, unknown>)[col];

          if (!colValue) {
            translatedCols[EN_CA][i][col] = colValue;
            translatedCols[FR_CA][i][col] = colValue;
            continue;
          }

          if (typeof colValue === 'string') {
            translatedCols[EN_CA][i][col] = this.i18nService.translateLang(
              colValue,
              EN_CA,
            ) as string;

            translatedCols[FR_CA][i][col] = this.i18nService.translateLang(
              colValue,
              FR_CA,
            ) as string;

            continue;
          }

          if (Array.isArray(colValue)) {
            translatedCols[EN_CA][i][col] = colValue.map((value) =>
              this.i18nService.translateLang(value || '', EN_CA),
            );

            translatedCols[FR_CA][i][col] = colValue.map((value) =>
              this.i18nService.translateLang(value || '', FR_CA),
            );
          }
        }
      }

      return translatedCols as { 'en-CA': Partial<T>[]; 'fr-CA': Partial<T>[] };
    });

    return computed(() => {
      const tableData = data();
      const currentLang = this.currentLang(); // recompute when lang changes
      const translationArrays = translatedCols();

      if (!tableData?.length || !translationArrays?.[currentLang]?.length) {
        return tableData;
      }

      const translationArray = translationArrays[currentLang];

      return tableData.map(
        (row, i) => ({ ...row, ...translationArray[i] }) as T,
      );
    });
  }
}
