import { Component, inject } from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { PagesDetailsFacade } from '../+state/pages-details.facade';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'upd-page-details-flow',
  templateUrl: './pages-details-flow.component.html',
  styleUrls: ['./pages-details-flow.component.css'],
})
export class PagesDetailsFlowComponent {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);

  currentLang = this.i18n.currentLang();

  data$ = this.pageDetailsService.pagesDetailsData$;
  error$ = this.pageDetailsService.error$;

  url = toSignal(this.pageDetailsService.pageUrl$) as () => string;
  rawDateRange = toSignal(this.pageDetailsService.rawDateRange$) as () => {
    start: string;
    end: string;
  };
}
