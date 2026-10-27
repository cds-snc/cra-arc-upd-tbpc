import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';

import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA, FR_CA } from '@dua-upd/upd/i18n';

const toLang = (lang: string | null) =>
  lang?.toLowerCase().startsWith('fr') ? 'fr' : 'en';

export const PortalPagesUrlRedirectGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const i18n = inject(I18nFacade);

  const screenId = route.queryParamMap.get('screenId')?.trim().toLowerCase();
  if (!screenId) return true;

  const pageLang = toLang(route.queryParamMap.get('pageLang'));

  const lang = toLang(route.queryParamMap.get('lang'));
  i18n.setLang(lang === 'fr' ? FR_CA : EN_CA);

  return http
    .get<{
      id: string | null;
      pageLang: string | null; 
    }>('/api/portal-pages/getPageId', { params: { screenId, pageLang } })
    .pipe(
      map(({ id }) =>
        router.createUrlTree(
          id
            ? ['/', lang, 'pages', 'portal', id, 'summary']
            : ['/', lang, 'pages', 'portal'],
        ),
      ),
      catchError(() =>
        of(
          router.createUrlTree(['/', lang, 'pages', 'portal'], {
            queryParams: { error: 1 },
          }),
        ),
      ),
    );
};
