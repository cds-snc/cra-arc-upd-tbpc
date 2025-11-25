import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import {
  searchKpiObjectiveCriteria,
  uxTestsKpiObjectiveCriteria,
  feedbackKpiObjectiveCriteria,
} from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA, type LocaleId } from '@dua-upd/upd/i18n';
import type { ColumnConfig } from '@dua-upd/types-common';
import { OverviewFacade } from '../+state/overview/overview.facade';
import { combineLatest } from 'rxjs';
import type { UnwrapSignal } from '@dua-upd/utils-common/types';

@Component({
    selector: 'upd-overview-summary',
    templateUrl: './overview-summary.component.html',
    styleUrls: ['./overview-summary.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class OverviewSummaryComponent implements OnInit {
  private overviewService = inject(OverviewFacade);
  private i18n = inject(I18nFacade);

  currentLang!: LocaleId;
  currentLang$ = this.i18n.currentLang$;
  currentLangSignal = this.i18n.currentLang;

  searchKpiObjectiveCriteria = searchKpiObjectiveCriteria;
  uxTestsKpiObjectiveCriteria = uxTestsKpiObjectiveCriteria;
  feedbackKpiObjectiveCriteria = feedbackKpiObjectiveCriteria;

  currentCallVolume$ = this.overviewService.currentCallVolume$;

  loaded$ = this.overviewService.loaded$;
  loading$ = this.overviewService.loading$;
  error$ = this.overviewService.error$;

  fullDateRangeLabel$ = this.overviewService.fullDateRangeLabel$;
  fullComparisonDateRangeLabel$ =
    this.overviewService.fullComparisonDateRangeLabel$;

  comboChartData$ = this.overviewService.comboChartData$;
  annotationsData$ = this.overviewService.annotationsData$;

  currentKpiFeedback$ = this.overviewService.currentKpiFeedback$;
  kpiFeedbackPercentChange$ = this.overviewService.kpiFeedbackPercentChange$;
  kpiFeedbackDifference$ = this.overviewService.kpiFeedbackDifference$;

  kpiUXTestsPercent$ = this.overviewService.kpiUXTestsPercent$;
  kpiUXTestsTotal$ = this.overviewService.kpiUXTestsTotal$;

  kpiLastAvgSuccessRate$ = this.overviewService.kpiLastAvgSuccessRate$;
  kpiTestsCompleted$ = this.overviewService.kpiTestsCompleted$;

  improvedKpiSuccessRateDifference$ =
    this.overviewService.improvedKpiSuccessRateDifference$;

  improvedKpiSuccessRateDifferencePoints$ = this.overviewService.improvedKpiSuccessRateDifferencePoints$;
  improvedKpiSuccessRateDifferencePointsRounded$ = this.overviewService.improvedKpiSuccessRateDifferencePointsRounded$;

  improvedKpiSuccessRateValidation$ =
    this.overviewService.improvedKpiSuccessRateValidation$;

  improvedKpiSuccessRateBaseline$ = this.overviewService.improvedKpiSuccessRateBaseline$;
  
  improvedKpi$ = this.overviewService.improvedKpi$;
  improvedKpiUniqueTasks$ = this.overviewService.improvedKpiUniqueTasks$;

  uniqueTaskTestedLatestTestKpi$ =
    this.overviewService.uniqueTaskTestedLatestTestKpi$;

  kpiSearchAssessment$ = this.overviewService.currentKpiSearchAssessment$;
  kpiSearchAssessmentPercentChange$ =
    this.overviewService.kpiSearchAssessmentPercentChange$;
  kpiSearchAssessmentPassed$ = this.overviewService.searchAssessmentPassed$;

  uniqueVisitors$ = this.overviewService.visitors$;
  uniqueVisitorsPercentChange$ = this.overviewService.visitorsPercentChange$;

  visits$ = this.overviewService.visits$;
  visitsPercentChange$ = this.overviewService.visitsPercentChange$;

  apexCallDrivers$ = this.overviewService.apexCallDrivers$;
  apexKpiFeedback$ = this.overviewService.apexKpiFeedback$;

  callPerVisits$ = this.overviewService.callPerVisits$;
  callComparisonPerVisits$ = this.overviewService.callComparisonPerVisits$;
  apexCallPercentChange$ = this.overviewService.apexCallPercentChange$;
  apexCallDifference$ = this.overviewService.apexCallDifference$;

  pageViews$ = this.overviewService.views$;
  pageViewsPercentChange$ = this.overviewService.viewsPercentChange$;

  gscImpressions$ = this.overviewService.impressions$;
  gscImpressionsPercentChange$ = this.overviewService.impressionsPercentChange$;

  gscCTR$ = this.overviewService.ctr$;
  gscCTRPercentChange$ = this.overviewService.ctrPercentChange$;

  gscAverage$ = this.overviewService.avgRank$;
  gscAveragePercentChange$ = this.overviewService.avgRankPercentChange$;

  dyfChart$ = this.overviewService.dyfData$;
  dyfChartApex$ = this.overviewService.dyfDataApex$;

  // barChartData$ = this.overviewService.visitsByDay$;
  // calldriversChartData$ = this.overviewService.calldriversByDay$;

  barTable$ = this.overviewService.tableMerge$;

  dateRangeLabel$ = this.overviewService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.overviewService.comparisonDateRangeLabel$;
  dyfChartLegend: string[] = [];
  langLink = 'en';
  satEnd = '';
  chartCols: ColumnConfig = { field: '', header: '' };
  chartData: { text: string; link: string }[] = [];
  donutChartCols: ColumnConfig = { field: '', header: '' };
  donutChartData: { text: string; link: string }[] = [];

  topTasksTable = this.overviewService.topTasksTable;

  topTasksTableCols: ColumnConfig<UnwrapSignal<typeof this.topTasksTable>>[] = [];

  dyfTableCols: ColumnConfig<{
    name: string;
    currValue: string;
    prevValue: string;
  }>[] = [];

  barTableCols: ColumnConfig<{
    date: string;
    visits: string;
    calls: string;
    annotations: string;
    prevDate: string;
    prevVisits: string;
    prevCalls: string;
  }>[] = [];

  getTrendIconAndColor(diff: number): { iconName: string; color: string } {
    let iconName = '';
    let color = '';

    if (diff > 0) {
      iconName = 'arrow_upward';
      color = '#26A69A';
    } else if (diff < 0) {
      iconName = 'arrow_downward';
      color = '#DF2929';
    } else {
      iconName = '';
      color = '';
    }

    return { iconName, color };
  }

  ngOnInit() {
    combineLatest([
      this.currentLang$,
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
      this.overviewService.satDateRangeLabel$,
    ]).subscribe(([lang, dateRange, comparisonDateRange, satDateRange]) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';
      this.satEnd = satDateRange.split('-')[1];

      this.dyfChartLegend = [
        this.i18n.service.translate('yes', lang),
        this.i18n.service.translate('no', lang),
      ];

      this.dyfTableCols = [
        {
          field: 'name',
          header: 'Selection',
        },
        {
          field: 'currValue',
          header: dateRange,
          pipe: 'number',
        },
        {
          field: 'prevValue',
          header: comparisonDateRange,
          pipe: 'number',
        },
      ];

      this.barTableCols = [
        { field: 'date', header: this.i18n.service.translate('Dates', lang) },
        {
          field: 'visits',
          header: this.i18n.service.translate('Visits for ', lang, {
            value: dateRange,
          }),
          pipe: 'number',
        },
        {
          field: 'calls',
          header: this.i18n.service.translate('Calls for ', lang, {
            value: dateRange,
          }),
          pipe: 'number',
        },
        {
          field: 'annotations',
          header: this.i18n.service.translate('Events for ', lang, {
            value: dateRange,
          }),
          columnClass: 'border-end',
        },
        {
          field: 'prevDate',
          header: this.i18n.service.translate('Dates', lang),
        },
        {
          field: 'prevVisits',
          header: this.i18n.service.translate('Visits for ', lang, {
            value: comparisonDateRange,
          }),
          pipe: 'number',
        },
        {
          field: 'prevCalls',
          header: this.i18n.service.translate('Calls for ', lang, {
            value: comparisonDateRange,
          }),
          pipe: 'number',
        },
      ];

      this.chartCols = {
        field: 'text',
        header: 'secondaryTitle',
        type: 'link',
        typeParams: {
          preLink: '/' + this.langLink + '/overview/',
          link: 'link',
        },
      } as ColumnConfig;

      this.chartData = [
        {
          text: this.i18n.service.translate('View more traffic data', lang),
          link: 'webtraffic',
        },
        {
          text: this.i18n.service.translate(
            'View more call drivers data',
            lang,
          ),
          link: 'calldrivers',
        },
      ];

      this.donutChartCols = {
        field: 'text',
        header: 'secondaryTitle',
        type: 'link',
        typeParams: {
          preLink: '/' + this.langLink + '/overview/',
          link: 'link',
        },
      } as ColumnConfig;

      this.donutChartData = [
        {
          text: this.i18n.service.translate(
            'View more page feedback data',
            lang,
          ),
          link: 'pagefeedback',
        },
      ];


      this.topTasksTableCols = [
        {
          field: 'tmf_rank',
          header: 'Rank',
          width: '80px',
          center: true,
        },
        {
          field: 'title',
          header: 'task',
          type: 'link',
          typeParams: { 
            preLink: '/' + this.langLink + '/tasks', 
            link: '_id' 
          },
          translate: true,
        },
        {
          field: 'visits',
          header: 'visits',
          pipe: 'number',
        },
        {
          field: 'calls',
          header: 'Call volume',
          pipe: 'number',
        },
        {
          field: 'calls_per_100_visits',
          header: 'kpi-calls-per-100-title',
          pipe: 'number',
          pipeParam: '1.0-2',
        },
        {
          field: 'dyf_no',
          header: 'negative-feedback-noclicks',
          pipe: 'number',
        },
        // {
        //   field: 'calls_per_100_visits_percent_change',
        //   header: 'kpi-calls-per-100-title-change',
        //   pipe: 'percent',
        //   pipeParam: '1.0-2',
        //   upGoodDownBad: false,
        //   indicator: true,
        //   useArrows: true,
        //   showTextColours: true,
        //   secondaryField: {
        //     field: 'calls_per_100_visits_difference',
        //     pipe: 'number',
        //     pipeParam: '1.0-2',
        //   },
        //   width: '170px',
        // },
        // {
        //   field: 'dyf_no_per_1000_visits_percent_change',
        //   header: 'kpi-feedback-per-1000-title-change',
        //   pipe: 'percent',
        //   pipeParam: '1.0-2',
        //   upGoodDownBad: false,
        //   indicator: true,
        //   useArrows: true,
        //   showTextColours: true,
        //   secondaryField: {
        //     field: 'dyf_no_per_1000_visits_difference',
        //     pipe: 'number',
        //     pipeParam: '1.0-2',
        //   },
        //   width: '220px',
        // },
        // {
        //   field: 'survey_completed',
        //   header: 'Self-reported success',
        //   pipe: 'percent',
        //   tooltip: 'tooltip-self-reported-success',
        //   width: '140px',
        // },
        {
          field: 'latest_ux_success',
          header: 'Task success',
          pipe: 'percent',
          tooltip: 'tooltip-latest-success-rate',
          width: '145px',
        },
        {
          field: 'latest_success_rate_percent_change',
          header: 'Task success change',
          pipe: 'percent',
          pipeParam: '1.0-2',
          upGoodDownBad: true,
          indicator: true,
          useArrows: true,
          showTextColours: true,
          secondaryField: {
            field: 'latest_success_rate_difference',
            pipe: 'number',
            pipeParam: '1.0-2',
          },
          width: '150px',
        },
      ];
    });
  }
}
