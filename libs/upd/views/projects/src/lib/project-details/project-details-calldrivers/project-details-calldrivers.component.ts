import { Component, inject, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';

@Component({
  selector: 'upd-project-details-calldrivers',
  templateUrl: './project-details-calldrivers.component.html',
  styleUrls: ['./project-details-calldrivers.component.css'],
})
export class ProjectDetailsCalldriversComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang$ = this.i18n.currentLang$;

  apexCalldriversChart$ = this.projectsDetailsService.apexCalldriversChart$;
  calldriversChart$ = this.projectsDetailsService.calldriversChart$;
  calldriversTable$ = this.projectsDetailsService.calldriversTable$;
  calldriversCols: ColumnConfig<{
    name: string;
    currValue: number;
    prevValue: number;
  }>[] = [];

  callsByTopic$ = this.projectsDetailsService.callsByTopic$;
  callsByTopicConfig$ = this.projectsDetailsService.callsByTopicConfig$;

  dateRangeLabel$ = this.projectsDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ =
    this.projectsDetailsService.comparisonDateRangeLabel$;

  ngOnInit() {
    combineLatest([
      this.currentLang$,
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
    ]).subscribe(([lang, dateRange, comparisonDateRange]) => {
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
    });
  }
}
