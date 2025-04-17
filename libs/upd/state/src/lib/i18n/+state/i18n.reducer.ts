import { createReducer, on, Action } from '@ngrx/store';

import * as I18nActions from './i18n.actions';
import { EN_CA, FR_CA, LocaleId } from '@dua-upd/upd/i18n';

export const I18N_FEATURE_KEY = 'i18n';

export interface I18nState {
  currentLang: LocaleId;
}

export interface I18nPartialState {
  readonly [I18N_FEATURE_KEY]: I18nState;
}

// todo: add localStorage
const getInitialLang = () => {
  if (location.pathname.slice(1).startsWith('fr')) {
    return FR_CA
  }

  if (location.pathname.slice(1).startsWith('en')) {
    return EN_CA;
  }

  if (navigator.language.startsWith('fr')) {
    return FR_CA;
  }

  return EN_CA;
}

export const i18nInitialState: I18nState = {
  currentLang: getInitialLang(),
};

const reducer = createReducer(
  i18nInitialState,
  on(I18nActions.setLang, (state, { lang }): I18nState =>
    lang === state.currentLang ? state : { currentLang: lang }
  )
);

export function i18nReducer(state: I18nState | undefined, action: Action) {
  return reducer(state, action);
}
