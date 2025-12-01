import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { combineLatest } from 'rxjs';
import { I18nFacade } from '@dua-upd/upd/state';
import { OverviewFacade } from './+state/overview/overview.facade';

@Component({
    selector: 'upd-overview',
    templateUrl: './overview.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class OverviewComponent implements OnInit {
  private overviewService = inject(OverviewFacade);
  private i18n = inject(I18nFacade);

  navTabs: { href: string; title: string }[] = [];

  currentLang$ = this.i18n.currentLang$;
  loading$ = this.overviewService.loading$;
  currentRoute$ = this.overviewService.currentRoute$;
  
  error = this.overviewService.error;

  ngOnInit() {
    this.overviewService.init();

    combineLatest([this.currentLang$]).subscribe(([lang]) => {
      this.navTabs = [
        {
          href: 'summary',
          title: this.i18n.service.translate('tab-summary', lang),
        },
        {
          href: 'webtraffic',
          title: this.i18n.service.translate('tab-webtraffic', lang),
        },
        {
          href: 'searchanalytics',
          title: this.i18n.service.translate('tab-searchanalytics', lang),
        },
        {
          href: 'pagefeedback',
          title: this.i18n.service.translate('tab-pagefeedback', lang),
        },
        {
          href: 'calldrivers',
          title: this.i18n.service.translate('tab-calldrivers', lang),
        },
        {
          href: 'uxtests',
          title: this.i18n.service.translate('tab-uxtests', lang),
        },
        {
          href: 'gctasks',
          title: this.i18n.service.translate('tab-gctasks', lang),
        },
      ];
    });
  }
}
