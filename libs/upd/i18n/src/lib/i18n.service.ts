import { computed, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type LangChangeEvent, TranslateService } from '@ngx-translate/core';
import type { LocaleId } from './i18n.types';
import { registerLocaleData } from '@angular/common';
import localeEnCa from '@angular/common/locales/en-CA';
import localeFrCa from '@angular/common/locales/fr-CA';
import { Observable, firstValueFrom, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private translateService = inject(TranslateService);

  langSignal = toSignal(
    this.translateService.onLangChange.pipe(
      map(({ lang }) => lang as LocaleId),
    ),
    {
      initialValue: this.translateService.currentLang as LocaleId,
    },
  );

  get currentLang() {
    return this.translateService.currentLang as LocaleId;
  }

  async get(key: string | string[], interpolateParams?: object) {
    return firstValueFrom<string | Record<string, string>>(
      this.translateService.get(key, interpolateParams),
    );
  }

  setupI18n() {
    registerLocaleData(localeEnCa, 'en-CA');
    registerLocaleData(localeFrCa, 'fr-CA');
    this.translateService.setDefaultLang('en-CA');
  }

  observeKey(key: string): Observable<string | Record<string, unknown>> {
    return this.translateService.stream(key);
  }

  observeKeys(keys: string[]): Observable<Record<string, string>> {
    return this.translateService.stream(keys);
  }

  translationSignal<T>(
    key: string,
    computation: (signal: Signal<string>) => T,
  ): Signal<T>;
  translationSignal(key: string): Signal<string>;
  translationSignal(keys: string[]): Signal<string[]>;
  translationSignal<T>(
    key: string | string[],
    computation?: (signal: Signal<string>) => T,
  ): Signal<string> | Signal<T> {
    const signal: Signal<string> = toSignal(this.translateService.stream(key), {
      initialValue: key,
    });

    if (computation) {
      return computed(() => computation(signal));
    }

    return signal;
  }

  computedMap<T>(
    input: T[] | Signal<T[]>,
    computation: (value: T, translate: (key: string) => string) => T,
  ): Signal<T[]> {
    return computed<T[]>(() => {
      this.langSignal();

      const inputArray = Array.isArray(input) ? input : input();

      return inputArray.map((val: T) =>
        computation(val, this.instant.bind(this)),
      );
    });
  }

  onLangChange(callback: (event: LangChangeEvent) => void) {
    this.translateService.onLangChange.subscribe(callback);
  }

  use(lang: LocaleId) {
    return this.translateService.use(lang);
  }

  // todo: refactor all uses of this (removed the need to use lang param)
  translate(key: string, lang: LocaleId, interpolateParams?: object): string {
    return this.translateService.instant(key, interpolateParams);
  }

  instant(key: string, interpolateParams?: object) {
    return this.translateService.instant(key, interpolateParams);
  }

  translateLang(key: string, lang: LocaleId): string {
    return this.translateService.store.translations[lang]?.[key] || key;
  }

  // to add translations at runtime if we need to
  addTranslations(lang: LocaleId, translations: Record<string, string>) {
    this.translateService.setTranslation(lang, translations, true);
  }
}
