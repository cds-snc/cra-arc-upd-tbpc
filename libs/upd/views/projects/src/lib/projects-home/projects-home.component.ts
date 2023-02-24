import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { ProjectsHomeFacade } from './+state/projects-home.facade';
import { ColumnConfig } from '@dua-upd/upd-components';

import { I18nFacade } from '@dua-upd/upd/state';
import { FR_CA, LocaleId } from '@dua-upd/upd/i18n';
import { ProjectsHomeProject } from '@dua-upd/types-common';
import { createCategoryConfig } from '@dua-upd/upd/utils';

@Component({
  selector: 'upd-projects-home',
  templateUrl: './projects-home.component.html',
  styleUrls: ['./projects-home.component.css'],
})
export class ProjectsHomeComponent implements OnInit {
  currentLang!: LocaleId;
  currentLang$ = this.i18n.currentLang$;

  data$ = this.projectsHomeService.projectsHomeData$;
  tableData$ = this.projectsHomeService.projectsHomeTableData$;

  numInProgress$ = this.projectsHomeService.numInProgress$;
  numPlanning$ = this.projectsHomeService.numPlanning$;
  numCompletedLast6Months$ = this.projectsHomeService.numCompletedLast6Months$;
  totalCompleted$ = this.projectsHomeService.totalCompleted$;
  numDelayed$ = this.projectsHomeService.numDelayed$;
  completedCOPS$ = this.projectsHomeService.completedCOPS$;

  columns: ColumnConfig<ProjectsHomeProject>[] = [];

  searchFields = this.columns.map((col) => col.field);

  constructor(
    private readonly projectsHomeService: ProjectsHomeFacade,
    private i18n: I18nFacade
  ) {}

  ngOnInit() {
    this.projectsHomeService.init();

    combineLatest([this.tableData$, this.currentLang$]).subscribe(
      ([data, lang]) => {
        this.columns = [
          {
            field: 'title',
            header: this.i18n.service.translate('Name', lang),
            type: 'link',
            typeParam: '_id',
            displayFilterOptions: false,
            displayTable: true,
          },
          {
            field: 'cops',
            header: this.i18n.service.translate('type', lang),
            type: 'label',
            typeParam: 'cops',
            filterConfig: {
              type: 'boolean',
            },
            displayFilterOptions: true,
            displayTable: true,
          },
          {
            field: 'status',
            header: this.i18n.service.translate('Status', lang),
            type: 'label',
            typeParam: 'status',
            filterConfig: {
              type: 'category',
              categories: createCategoryConfig({
                i18n: this.i18n.service,
                data,
                field: 'status',
              }),
            },
            displayFilterOptions: true,
            displayTable: true,
          },
          {
            field: 'startDate',
            header: this.i18n.service.translate('Start date', lang),
            pipe: 'date',
            pipeParam: lang === FR_CA ? 'd MMM YYYY' : 'MMM dd, YYYY',
            displayFilterOptions: false,
            displayTable: true,
          },
          {
            field: 'lastAvgSuccessRate',
            header: this.i18n.service.translate('Average success rate', lang),
            pipe: 'percent',
            displayFilterOptions: false,
            displayTable: true,
          },
        ];
      }
    );
  }
}
