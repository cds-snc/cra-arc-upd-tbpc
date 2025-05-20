import { Component, inject, OnInit } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { OverviewFacade } from '../+state/overview/overview.facade';
import type { GetTableProps } from '@dua-upd/utils-common';
import { createCategoryConfig } from '@dua-upd/upd/utils';

type searchAssessmentColTypes = GetTableProps<
  OverviewSearchAnalyticsComponent,
  'searchAssessmentData$'
>;

@Component({
    selector: 'upd-overview-search-analytics',
    templateUrl: './overview-search-analytics.component.html',
    styleUrls: ['./overview-search-analytics.component.css'],
    standalone: false
})
export class OverviewSearchAnalyticsComponent implements OnInit {
  private overviewService = inject(OverviewFacade);
  private i18n = inject(I18nFacade);

  currentLang$ = this.i18n.currentLang$;

  gscImpressions$ = this.overviewService.impressions$;
  gscImpressionsPercentChange$ = this.overviewService.impressionsPercentChange$;

  gscCTR$ = this.overviewService.ctr$;
  gscCTRPercentChange$ = this.overviewService.ctrPercentChange$;

  gscAverage$ = this.overviewService.avgRank$;
  gscAveragePercentChange$ = this.overviewService.avgRankPercentChange$;

  GSCSearchTerms$ = this.overviewService.top10GSC$;

  searchAssessmentData$ = this.overviewService.searchAssessmentData$;

  GSCSearchTermsCols: ColumnConfig<GscSearchTermsRow>[] = [];
  searchAssessmentCols: ColumnConfig<searchAssessmentColTypes>[] = [];

  satDateRangeLabel$ = this.overviewService.satDateRangeLabel$;
  satStart = '';
  satEnd = '';

  topSearchTermsEn$ = this.overviewService.top20SearchTermsEn$.pipe(
    map((searchTerms) => [...searchTerms]),
  );
  topSearchTermsFr$ = this.overviewService.top20SearchTermsFr$.pipe(
    map((searchTerms) => [...searchTerms]),
  );
  searchTermsColConfig$ = this.overviewService.searchTermsColConfig$;

  ngOnInit() {
    combineLatest([
      this.searchAssessmentData$,
      this.currentLang$,
      this.satDateRangeLabel$,
    ]).subscribe(([data, lang, satDateRange]) => {
      this.satStart = satDateRange.split('-')[0];
      this.satEnd = satDateRange.split('-')[1];

      // this.CanSearchTermsCols = [
      //   { field: 'Search terms', header: this.i18n.service.translate('search-terms', lang) },
      //   { field: 'Clicks', header: this.i18n.service.translate('clicks', lang) },
      //   { field: 'Comparison', header: this.i18n.service.translate('comparison', lang) }
      // ];
      this.GSCSearchTermsCols = [
        {
          field: '_id',
          header: this.i18n.service.translate('search-term', lang),
        },
        {
          field: 'clicks',
          header: this.i18n.service.translate('clicks', lang),
          pipe: 'number',
        },
        {
          field: 'percentChange',
          header: this.i18n.service.translate('change', lang),
          pipe: 'percent',
        },
        {
          field: 'impressions',
          header: this.i18n.service.translate('impressions', lang),
          pipe: 'number',
        },
        {
          field: 'ctr',
          header: this.i18n.service.translate('ctr', lang),
          pipe: 'percent',
        },
        {
          field: 'position',
          header: this.i18n.service.translate('position', lang),
          pipe: 'number',
          pipeParam: '1.0-2',
        },
      ];

      this.searchAssessmentCols = [
        {
          field: 'query',
          header: this.i18n.service.translate('search-term', lang),
        },
        {
          field: 'lang',
          header: this.i18n.service.translate('Search term language', lang),
          filterConfig: {
            type: 'category',
            categories: createCategoryConfig({
              i18n: this.i18n.service,
              data,
              field: 'lang',
            }),
          },
        },
        {
          field: 'url',
          header: this.i18n.service.translate('Target URL', lang),
          type: 'link',
          typeParams: {
            external: true,
            link: 'url',
          },
        },
        {
          field: 'total_searches',
          header: this.i18n.service.translate('Total searches', lang),
          pipe: 'number',
        },
        {
          field: 'target_clicks',
          header: this.i18n.service.translate('Target URL clicks', lang),
          pipe: 'number',
        },
        {
          field: 'position',
          header: this.i18n.service.translate('avg-rank', lang),
        },
        {
          field: 'pass',
          header: this.i18n.service.translate('Result', lang),
          type: 'text',
          typeParam: 'passFail',
        },
      ];
    });
  }
}

interface GscSearchTermsRow {
  _id: string;
  clicks: number;
  percentChange: number;
  impressions: number;
  ctr: number;
  position: number;
}
