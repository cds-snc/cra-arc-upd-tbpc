import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';
import { uxTestsKpiObjectiveCriteria } from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA, FR_CA, LocaleId } from '@dua-upd/upd/i18n';
import type { OverviewProject } from '@dua-upd/types-common';
import { OverviewFacade } from '../+state/overview/overview.facade';

@Component({
    selector: 'upd-overview-ux-tests',
    templateUrl: './overview-ux-tests.component.html',
    styleUrls: ['./overview-ux-tests.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class OverviewUxTestsComponent implements OnInit {
  private overviewService = inject(OverviewFacade);
  private i18n = inject(I18nFacade);

  currentLang!: LocaleId;
  currentLang$ = this.i18n.currentLang$;
  currentLangSignal = this.i18n.currentLang;
  langLink = 'en';

  uxTestsKpiObjectiveCriteria = uxTestsKpiObjectiveCriteria;
  uxChartData = this.overviewService.projectsList$;

  tasksTested$ = this.overviewService.uxTasksTested$;
  participantsTested$ = this.overviewService.uxParticipantsTested$;
  testsConductedLastFiscal$ = this.overviewService.uxTestsConductedLastFiscal$;
  testsConductedLastQuarter$ =
    this.overviewService.uxTestsConductedLastQuarter$;
  COPSTests$ = this.overviewService.uxCopsTestsCompleted$;

  kpiUXTestsPercent$ = this.overviewService.kpiUXTestsPercent$;
  kpiUXTestsTotal$ = this.overviewService.kpiUXTestsTotal$;

  improvedKpiSuccessRate$ = this.overviewService.improvedKpiSuccessRate$;
  improvedKpiSuccessRateDifference$ =
    this.overviewService.improvedKpiSuccessRateDifference$;

  improvedKpiSuccessRateDifferencePoints$ = this.overviewService.improvedKpiSuccessRateDifferencePoints$;

  improvedKpiSuccessRateValidation$ =
    this.overviewService.improvedKpiSuccessRateValidation$;
  
  improvedKpiSuccessRateBaseline$ = this.overviewService.improvedKpiSuccessRateBaseline$;
    
  wosImprovedKpiSuccessRateDifferencePoints$ = this.overviewService.wosImprovedKpiSuccessRateDifferencePoints$;

  wosImprovedKpiSuccessRateValidation$ =
    this.overviewService.wosImprovedKpiSuccessRateValidation$;
  
  wosImprovedKpiSuccessRateBaseline$ =
    this.overviewService.wosImprovedKpiSuccessRateBaseline$;
 
  improvedKpi$ = this.overviewService.improvedKpi$;
  improvedKpiUniqueTasks$ = this.overviewService.improvedKpiUniqueTasks$;

  wosImprovedKpiUniqueTasks$ = this.overviewService.wosImprovedKpiUniqueTasks$;

  improvedKpiTopSuccessRate$ = this.overviewService.improvedKpiTopSuccessRate$;
  improvedKpiTopSuccessRateDifference$ =
    this.overviewService.improvedKpiTopSuccessRateDifference$;

  improvedKpiTopSuccessRateDifferencePoints$ = this.overviewService.improvedKpiTopSuccessRateDifferencePoints$;

  improvedKpiTopSuccessRateValidation$ =
    this.overviewService.improvedKpiTopSuccessRateValidation$;

  improvedKpiTopSuccessRateBaseline$ =
    this.overviewService.improvedKpiTopSuccessRateBaseline$; 

  improvedTopKpi$ = this.overviewService.improvedTopKpi$;
  improvedKpiTopUniqueTasks$ = this.overviewService.improvedKpiTopUniqueTasks$;
  improvedKpiTopTasks$ = this.overviewService.improvedKpiTopTasks$;

  kpiLastAvgSuccessRate$ = this.overviewService.kpiLastAvgSuccessRate$;
  kpiTestsCompleted$ = this.overviewService.kpiTestsCompleted$;
  uniqueTaskTestedLatestTestKpi$ =
    this.overviewService.uniqueTaskTestedLatestTestKpi$;

  totalTasks$ = this.overviewService.totalTasks$;

  kpiTotAvgSuccessRate$ = this.overviewService.kpiTotAvgSuccessRate$;

  uxChartCols: ColumnConfig<OverviewProject>[] = [];

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
    this.currentLang$.subscribe((lang) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';

      this.uxChartCols = [
        {
          field: 'title',
          header: this.i18n.service.translate('ux_projects', lang),
          type: 'link',
          typeParams: {
            preLink: '/' + this.langLink + '/projects',
            link: '_id',
          },
        },
        {
          field: 'testType',
          header: this.i18n.service.translate('Test', lang),
        },
        {
          field: 'startDate',
          header: this.i18n.service.translate('Start date', lang),
          pipe: 'date',
          pipeParam: lang === FR_CA ? 'd MMM yyyy' : 'MMM dd, yyyy',
        },
        {
          field: 'lastAvgSuccessRate',
          header: this.i18n.service.translate('Average success rate', lang),
          pipe: 'percent',
          tooltip: 'tooltip-avg_success_last_uxtest'
        },
        {
          field: 'totalUsers',
          header: this.i18n.service.translate('number_of_participants', lang),
        },
      ];
    });
  }
}
