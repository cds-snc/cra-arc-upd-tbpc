import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';

import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA, FR_CA } from '@dua-upd/upd/i18n';

const sanitizeUrl = (url: string) =>
  url.trim().replace(/^https?:\/\//, '')

const toLang = (lang: string | null) =>
  lang?.toLowerCase().startsWith('fr') ? 'fr' : 'en';

export const PortalPagesUrlRedirectGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const i18n = inject(I18nFacade);

  const rawUrl = route.queryParamMap.get('url');
  if (!rawUrl) return true;

  const lang = toLang(route.queryParamMap.get('lang'));
  i18n.setLang(lang === 'fr' ? FR_CA : EN_CA);

  return http
    .get<{
      id: string | null;
    }>('/api/portal-pages/getPageId', { params: { url: sanitizeUrl(rawUrl) } })
    .pipe(
      map(({ id }) =>
        router.createUrlTree(
          id ? ['/', lang, 'portal-pages', id, 'summary'] : ['/', lang, 'portal-pages'],
        ),
      ),
      catchError(() =>
        of(
          router.createUrlTree(['/', lang, 'portal-pages'], {
            queryParams: { error: 1 },
          }),
        ),
      ),
    );
};
