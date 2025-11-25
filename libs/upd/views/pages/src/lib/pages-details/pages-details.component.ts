import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PagesDetailsFacade } from './+state/pages-details.facade';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { filter, map, startWith } from 'rxjs';
import { EN_CA } from '@dua-upd/upd/i18n';
import { NavigationEnd, Router } from '@angular/router';

@Component({
    selector: 'upd-page-details',
    templateUrl: './pages-details.component.html',
    styleUrls: ['./pages-details.component.css'],
    standalone: false
})
export class PagesDetailsComponent {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);
  private router = inject(Router);

  constructor() {
    this.pageDetailsService.init();
  }

  title$ = this.pageDetailsService.pageTitle$;
  url = toSignal(this.pageDetailsService.pageUrl$);
  pageStatus$ = this.pageDetailsService.pageStatus$;
  loading$ = this.pageDetailsService.loading$;
  showUrl = true;
  showAlert = false;
  altPageId = toSignal(this.pageDetailsService.altPageId$);
  currentLang = this.i18n.currentLang;
  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));
  projects = toSignal(this.pageDetailsService.projects$);
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

  navigateToAltPage() {
    window.location.href = `/${this.langLink()}/pages/${this.altPageId()}/${this.currentUrl()}`;
  }

  navTabs: { href: string; title: string }[] = [
    {
      href: 'summary',
      title: 'tab-summary',
    },
    {
      href: 'webtraffic',
      title: 'tab-webtraffic',
    },
    {
      href: 'searchanalytics',
      title: 'tab-searchanalytics',
    },
    {
      href: 'pagefeedback',
      title: 'tab-pagefeedback',
    },
    {
      href: 'flow',
      title: 'tab-flow',
    },
    {
      href: 'readability',
      title: 'tab-readability',
    },
    {
      href: 'version-history',
      title: 'tab-version-history',
    },
    {
      href: 'accessibility',
      title: 'tab-accessibility',
    },
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
