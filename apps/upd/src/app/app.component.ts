import { Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRoute,
  ChildrenOutletContexts,
  NavigationEnd,
  Router,
} from '@angular/router';
import { EN_CA } from '@dua-upd/upd/i18n';
import { I18nFacade } from '@dua-upd/upd/state';
import packageJson from 'package.json';
import type { Translation } from 'primeng/api';
import { PrimeNG } from 'primeng/config';
import { filter, map, mergeMap } from 'rxjs';
import { fader } from './app.animations';
import { SwUpdateService } from './sw-update.service';

@Component({
  selector: 'upd-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [fader],
  standalone: false,
})
export class AppComponent {
  i18n = inject(I18nFacade);
  contexts = inject(ChildrenOutletContexts);
  router = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  titleService = inject(Title);
  primeNgConfig = inject(PrimeNG);

  primeNgConfigSignal = toSignal(this.i18n.service.observeKey('primeng'));

  currentLang = this.i18n.currentLang;

  titleFromNavigation = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) route = route.firstChild;
        return route;
      }),
      filter((route: ActivatedRoute) => route.outlet === 'primary'),
      mergeMap((route: ActivatedRoute) => route.data),
      map((data): string => data['title'] ?? 'Usability Performance Dashboard'),
    ),
    { initialValue: 'Usability Performance Dashboard' },
  );

  en = EN_CA;
  updVersion = packageJson.version;
  canadaLogo = '../assets/img/canada-black-30mm.png';

  constructor(private swUpdates: SwUpdateService) {
    this.i18n.init();

    effect(() => {
      this.currentLang();

      const translatedTitle = this.i18n.service.instant(
        this.titleFromNavigation(),
      );

      this.titleService.setTitle(translatedTitle);
    });

    effect(() =>
      this.primeNgConfig.setTranslation(
        this.primeNgConfigSignal() as Translation,
      ),
    );
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }
}
