import { Component, inject, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { callVolumeObjectiveCriteria } from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import type { LocaleId } from '@dua-upd/upd/i18n';
import type { ColumnConfig } from '@dua-upd/types-common';
import { OverviewFacade } from '../+state/overview/overview.facade';
import type { GetTableProps } from '@dua-upd/utils-common';
import { createCategoryConfig } from '@dua-upd/upd/utils';

type callDriversColTypes = GetTableProps<
  OverviewCalldriversComponent,
  'calldriverTopics$'
>;

@Component({
  selector: 'upd-overview-calldrivers',
  templateUrl: './overview-calldrivers.component.html',
  styleUrls: ['./overview-calldrivers.component.css'],
})
export class OverviewCalldriversComponent implements OnInit {
  private overviewService = inject(OverviewFacade);
  private i18n = inject(I18nFacade);

  currentLang!: LocaleId;
  currentLang$ = this.i18n.currentLang$;

  dateRangeLabel$ = this.overviewService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.overviewService.comparisonDateRangeLabel$;

  currentCallVolume$ = this.overviewService.currentCallVolume$;
  callPercentChange$ = this.overviewService.callPercentChange$;

  apexCallDriversChart$ = this.overviewService.apexCallDriversChart$;

  // calldriversChart$ = this.overviewService.calldriversChart$;
  calldriversTable$ = this.overviewService.calldriversTable$;
  calldriversCols: ColumnConfig<{
    name: string;
    currValue: number;
    prevValue: number;
  }>[] = [];

  calldriverTopics$ = this.overviewService.calldriverTopics$;
  calldriverTopicsCols: ColumnConfig<callDriversColTypes>[] = [];

  top5IncreasedCalldriverTopics$ =
    this.overviewService.top5IncreasedCalldriverTopics$;
  top5IncreasedCalldriverTopicsConfig$ =
    this.overviewService.top5IncreasedCalldriverTopicsConfig$;

  top5DecreasedCalldriverTopics$ =
    this.overviewService.top5DecreasedCalldriverTopics$;
  top5DecreasedCalldriverTopicsConfig$ =
    this.overviewService.top5DecreasedCalldriverTopicsConfig$;

  callVolumeObjectiveCriteria = callVolumeObjectiveCriteria;
  callVolumeKpiConfig = {
    pass: { message: 'kpi-met-volume' },
    fail: { message: 'kpi-not-met-volume' },
  };

  ngOnInit() {
    combineLatest([
      this.currentLang$,
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
      this.calldriverTopics$,
    ]).subscribe(([lang, dateRange, comparisonDateRange, data]) => {
      this.calldriversCols = [
        {
          field: 'name',
          header: this.i18n.service.translate('enquiry_line', lang),
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

      this.calldriverTopicsCols = [
        {
          field: 'tpc_id',
          header: 'tpc_id',
        },
        {
          field: 'enquiry_line',
          header: 'enquiry_line',
          filterConfig: {
            type: 'category',
            categories: createCategoryConfig({
              i18n: this.i18n.service,
              data,
              field: 'enquiry_line',
            }),
          },
        },
        {
          field: 'topic',
          header: 'topic',
          translate: true,
        },
        {
          field: 'subtopic',
          header: 'sub-topic',
          translate: true,
        },
        {
          field: 'sub_subtopic',
          header: 'sub-subtopic',
          translate: true,
        },
        {
          field: 'tasks',
          header: 'tasks',
          translate: true,
        },
        {
          field: 'calls',
          header: 'calls',
          pipe: 'number',
        },
        {
          field: 'change',
          header: 'change',
          pipe: 'percent',
          pipeParam: '1.0-2',
          upGoodDownBad: false,
          indicator: true,
          useArrows: true,
          showTextColours: true,
          secondaryField: {
            field: 'difference',
            pipe: 'number',
          },
          width: '160px',
        },
      ];
    });
  }
}
