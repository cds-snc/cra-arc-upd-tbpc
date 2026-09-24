import { Component, computed, inject, OnInit, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { I18nFacade } from '@dua-upd/upd/state';
import type { ColumnConfig } from '@dua-upd/types-common';
import type { GetTableProps } from '@dua-upd/utils-common';

import { PortalPagesDetailsFacade } from '../+state/portal-pages-details.facade';

type VisitsByDeviceColTypes = GetTableProps<
  PortalPagesDetailsSummaryComponent,
  'visitsByDeviceTypeTable$'
>;

type VisitorLocationColTypes = GetTableProps<
  PortalPagesDetailsSummaryComponent,
  'visitorLocation$'
>;

type BarTableColTypes = GetTableProps<
  PortalPagesDetailsSummaryComponent,
  'barTable$'
>;

@Component({
  selector: 'upd-portal-page-details-summary',
  templateUrl: './portal-pages-details-summary.component.html',
  styleUrls: ['./portal-pages-details-summary.component.css'],
  standalone: false,
})
export class PortalPagesDetailsSummaryComponent implements OnInit {
  private readonly i18n = inject(I18nFacade);
  private readonly pageDetailsService = inject(PortalPagesDetailsFacade);

  currentLang = this.i18n.currentLang;

  data$ = this.pageDetailsService.portalPagesDetailsData$;
  error$ = this.pageDetailsService.error$;

  /*
   * Summary metrics
   */

  visitors$ = this.pageDetailsService.visitors$;
  visitorsPercentChange$ = this.pageDetailsService.visitorsPercentChange$;

  visits = toSignal(this.pageDetailsService.visits$, {
    initialValue: 0,
  });

  visitsPercentChange$ = this.pageDetailsService.visitsPercentChange$;

  pageViews$ = this.pageDetailsService.pageViews$;
  pageViewsPercentChange$ = this.pageDetailsService.pageViewsPercentChange$;

  averageTimeSpent$ = this.pageDetailsService.averageTimeSpent$;

  averageTimeSpentPercentChange$ =
    this.pageDetailsService.averageTimeSpentPercentChange$;

  /*
   * Date labels
   */

  dateRangeLabel = toSignal(this.pageDetailsService.dateRangeLabel$, {
    initialValue: '',
  });

  comparisonDateRangeLabel = toSignal(
    this.pageDetailsService.comparisonDateRangeLabel$,
    {
      initialValue: '',
    },
  );

  /*
   * Device data
   */

  apexBar$ = this.pageDetailsService.apexBar$;

  barTable$ = this.pageDetailsService.barTable$;

  apexVisitsByDeviceTypeChart$ =
    this.pageDetailsService.apexVisitsByDeviceTypeChart$;

  visitsByDeviceTypeTable$ = this.pageDetailsService.visitsByDeviceTypeTable$;

  visitsByDeviceTypeCols: Signal<ColumnConfig<VisitsByDeviceColTypes>[]> =
    computed(() => [
      {
        field: 'name',
        header: this.i18n.service.translate('Device Type', this.currentLang()),
      },
      {
        field: 'currValue',
        header: this.dateRangeLabel(),
        pipe: 'number',
      },
      {
        field: 'prevValue',
        header: this.comparisonDateRangeLabel(),
        pipe: 'number',
      },
    ]);

  /*
   * Location data
   */

  visitorLocation$ = this.pageDetailsService.visitorLocation$;

  visitorLocationCols: Signal<ColumnConfig<VisitorLocationColTypes>[]> =
    computed(() => [
      {
        field: 'location',
        header: this.i18n.service.translate('Location', this.currentLang()),
      },
      {
        field: 'currentValue',
        header: this.dateRangeLabel(),
        pipe: 'number',
      },
      {
        field: 'prevValue',
        header: this.comparisonDateRangeLabel(),
        pipe: 'number',
      },
      {
        field: 'change',
        header: this.i18n.service.translate('Change', this.currentLang()),
        pipe: 'percent',
      },
    ]);

  barTableCols: Signal<ColumnConfig<BarTableColTypes>[]> = computed(() => [
    {
      field: 'date',
      header: 'Dates',
    },
    {
      field: 'visits',
      header: this.i18n.service.translate('Visits for ', this.currentLang(), {
        value: this.dateRangeLabel(),
      }),
      pipe: 'number',
    },
    {
      field: 'prevDate',
      header: 'Dates',
    },
    {
      field: 'prevVisits',
      header: this.i18n.service.translate('Visits for ', this.currentLang(), {
        value: this.comparisonDateRangeLabel(),
      }),
      pipe: 'number',
    },
  ]);

  ngOnInit() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
}
