import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PortalPagesDetailsFacade } from './+state/portal-pages-details.facade';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { filter, map, startWith } from 'rxjs';
import { EN_CA } from '@dua-upd/upd/i18n';
import { NavigationEnd, Router } from '@angular/router';

@Component({
    selector: 'upd-portal-page-details',
    templateUrl: './portal-pages-details.component.html',
    styleUrls: ['./portal-pages-details.component.css'],
    standalone: false
})
export class PortalPagesDetailsComponent {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PortalPagesDetailsFacade);
  private router = inject(Router);

  constructor() {
    this.pageDetailsService.init();
  }

  title$ = this.pageDetailsService.pageTitle$;
  url = toSignal(this.pageDetailsService.pageUrl$);
  loading$ = this.pageDetailsService.loading$;
  showUrl = true;
  showAlert = false;
  currentLang = this.i18n.currentLang;
  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));
  pageLang = toSignal(this.pageDetailsService.pageLang$);
  pageLangText = computed(() => {
    const langLink = this.langLink();
    const pageLang = this.pageLang() === 'fr' ? 'en' : 'fr';
  
    const translations = {
      en: { fr: "French", en: "English" },
      fr: { fr: "française", en: "en anglais" },
    };
  
    return translations[langLink]?.[pageLang];
  });

  currentRoute$ = this.pageDetailsService.currentRoute$;
  currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() =>
        this.router.url.substring(this.router.url.lastIndexOf('/') + 1),
      ),
      startWith(
        this.router.url.substring(this.router.url.lastIndexOf('/') + 1),
      ),
    ),
  );

  // navigateToAltPage() {
  //   window.location.href = `/${this.langLink()}/portal-pages/${this.altPageId()}/${this.currentUrl()}`;
  // }

  navTabs: { href: string; title: string }[] = [
    {
      href: 'summary',
      title: 'tab-summary',
    }
  ];

  projectsCol = computed(() => {
    return {
      field: 'title',
      header: 'project',
      type: 'link',
      typeParams: {
        preLink: '/' + this.langLink() + '/projects',
        link: 'id',
      },
      translate: true,
    } as ColumnConfig;
  });

  toggleUrl() {
    this.showUrl = !this.showUrl;
  }

  toggleAlert() {
    this.showAlert = !this.showAlert;
  }
}
