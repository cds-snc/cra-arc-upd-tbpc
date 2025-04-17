import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nFacade, selectRoute } from '@dua-upd/upd/state';
import { map } from 'rxjs';
import { FR_CA } from '@dua-upd/upd/i18n';
import { Store } from '@ngrx/store';

@Component({
  selector: 'upd-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  i18n = inject(I18nFacade);
  private readonly store = inject(Store);

  currentRoute = this.store.selectSignal(selectRoute);

  routeIsCustomReports = computed(
    () => !!this.currentRoute()?.match(/\/[enfr]{2}\/custom-reports/),
  );

  queryParamsHandling = computed(() =>
    this.routeIsCustomReports() ? '' : 'merge',
  );

  isFr = toSignal(this.i18n.currentLang$.pipe(map((lang) => lang === FR_CA)), {
    initialValue: false,
  });

  updLogo = computed(
    () =>
      (this.isFr()
        ? '../../../assets/img/upd-logo-fr.png'
        : '../../../assets/img/upd-logo.png') as string,
  );

  langPath = computed(() => (this.isFr() ? 'fr' : 'en'));
}
