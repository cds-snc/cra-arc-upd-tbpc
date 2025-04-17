import { Component, inject, OnInit } from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { PagesDetailsFacade } from '../+state/pages-details.facade';
import { toSignal } from '@angular/core/rxjs-interop';
import { UrlHash } from '@dua-upd/types-common';

@Component({
  selector: 'upd-page-details-versions',
  templateUrl: './pages-details-versions.component.html',
  styleUrls: ['./pages-details-versions.component.css'],
})
export class PagesDetailsVersionsComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);

  currentLang = this.i18n.currentLang();

  data$ = this.pageDetailsService.pagesDetailsData$;
  error$ = this.pageDetailsService.error$;
  loadingHashes = toSignal(
    this.pageDetailsService.loadingHashes$,
  ) as () => boolean;
  hashes = this.pageDetailsService.hashesData;
  url = toSignal(this.pageDetailsService.pageUrl$) as () => string;

  getHashes() {
    this.pageDetailsService.getHashes();
  }

  ngOnInit() {
    this.getHashes();
  }
}
