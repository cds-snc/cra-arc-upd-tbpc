import { Component, inject } from '@angular/core';
import { PagesDetailsFacade } from '../+state/pages-details.facade';
import type { ColumnConfig, InternalSearchTerm } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import type { GetTableProps } from '@dua-upd/utils-common';
import { map } from 'rxjs';

type GscSearchTermsColTypes = GetTableProps<
  PagesDetailsSearchAnalyticsComponent,
  'topGSCSearchTerms$'
>;
type ReferrerTypeColTypes = GetTableProps<
  PagesDetailsSearchAnalyticsComponent,
  'referrerType$'
>;

@Component({
  selector: 'upd-page-details-search-analytics',
  templateUrl: './pages-details-search-analytics.component.html',
  styleUrls: ['./pages-details-search-analytics.component.css'],
})
export class PagesDetailsSearchAnalyticsComponent {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);
  currentLang = this.i18n.currentLang;

  totalImpressionsGSC$ = this.pageDetailsService.impressions$;
  totalImpressionsGSCPercentChange$ =
    this.pageDetailsService.impressionsPercentChange$;

  ctrGSC$ = this.pageDetailsService.ctr$;
  ctrGSCPercentChange$ = this.pageDetailsService.ctrPercentChange$;

  avgRankGSC$ = this.pageDetailsService.avgRank$;
  avgRankGSCPercentChange$ = this.pageDetailsService.avgRankPercentChange$;

  topGSCSearchTerms$ = this.pageDetailsService.top25GSCSearchTerms$;

  topSearchTerms$ = this.pageDetailsService.topSearchTerms$.pipe(
    map((searchTerms) => [...searchTerms]),
  );

  referrerType$ = this.pageDetailsService.referrerType$;

  searchTermsColConfig: ColumnConfig<InternalSearchTerm>[] = [
    { field: 'term', header: 'search-term' },
    { field: 'clicks', header: 'clicks', pipe: 'number' },
    { field: 'clicksChange', header: 'change-for-clicks', pipe: 'percent' },
    {
      field: 'position',
      header: 'position',
      pipe: 'number',
      pipeParam: '1.0-2',
    },
  ];

  topGscSearchTermsCols: ColumnConfig<GscSearchTermsColTypes>[] = [
    {
      field: 'term',
      header: 'search-terms',
    },
    {
      field: 'clicks',
      header: 'clicks',
      pipe: 'number',
    },
    {
      field: 'change',
      header: 'change',
      pipe: 'percent',
    },
    {
      field: 'impressions',
      header: 'impressions',
      pipe: 'number',
    },
    {
      field: 'ctr',
      header: 'ctr',
      pipe: 'percent',
    },
    {
      field: 'position',
      header: 'position',
      pipe: 'number',
      pipeParam: '1.0-2',
    },
  ];

  referrerTypeCols: ColumnConfig<ReferrerTypeColTypes>[] = [
    {
      field: 'type',
      header: 'type',
    },
    {
      field: 'value',
      header: 'visits',
      pipe: 'number',
    },
    {
      field: 'change',
      header: 'change',
      pipe: 'percent',
    },
  ];
}
