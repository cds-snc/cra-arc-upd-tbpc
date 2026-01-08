import { Component, inject, OnInit } from '@angular/core';
import { UnwrapObservable } from '@dua-upd/utils-common';
import { combineLatest, map } from 'rxjs';
import { ProjectsHomeFacade } from './+state/projects-home.facade';
import type { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { FR_CA } from '@dua-upd/upd/i18n';
import { createCategoryConfig } from '@dua-upd/upd/utils';

@Component({
    selector: 'upd-projects-home',
    templateUrl: './projects-home.component.html',
    styleUrls: ['./projects-home.component.css'],
    standalone: false
})
export class ProjectsHomeComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly projectsHomeService = inject(ProjectsHomeFacade);

  loading$ = this.projectsHomeService.loaded$.pipe(map((loaded) => !loaded));

  data$ = this.projectsHomeService.projectsHomeData$;
  tableData$ = this.projectsHomeService.projectsHomeTableData$;

  numInProgress$ = this.projectsHomeService.numInProgress$;
  numPlanning$ = this.projectsHomeService.numPlanning$;
  numCompletedLast6Months$ = this.projectsHomeService.numCompletedLast6Months$;
  totalCompleted$ = this.projectsHomeService.totalCompleted$;
  numDelayed$ = this.projectsHomeService.numDelayed$;
  completedCOPS$ = this.projectsHomeService.completedCOPS$;

  columns: ColumnConfig<UnwrapObservable<typeof this.tableData$>>[] = [];

  searchFields = this.columns.map((col) => col.field);

  ngOnInit() {
    this.projectsHomeService.init();

    combineLatest([this.tableData$, this.i18n.currentLang$]).subscribe(
      ([data, lang]) => {
        this.columns = [
          {
            field: 'title',
            header: this.i18n.service.translate('Name', lang),
            type: 'link',
            typeParam: '_id',
          },
          // {
          //   field: 'cops',
          //   header: this.i18n.service.translate('type', lang),
          //   type: 'label',
          //   typeParam: 'cops',
          //   filterConfig: {
          //     type: 'boolean',
          //   },
          // },
          // {
          //   field: 'wos_cops',
          //   header: this.i18n.service.translate('type', lang),
          //   type: 'label',
          //   typeParam: 'wos_cops',
          //   filterConfig: {
          //     type: 'boolean',
          //   },
          // },
          // {
          //   field: 'projectTypeLabel',
          //   header: this.i18n.service.translate('type', lang),
          //   type: 'label',
          //   typeParam: 'projectType',
          //   filterConfig: {
          //     type: 'category',
          //     categories: createCategoryConfig({
          //       i18n: this.i18n.service,
          //       data,
          //       field: 'projectTypeLabel',
          //     }),
          //   },
          // },
          {
            field: 'projectTypeLabel',
            header: this.i18n.service.translate('type', lang),
            type: 'label',
            typeParam: 'projectType',
            filterConfig: {
              type: 'category',
              categories: [
                { name: this.i18n.service.translate('COPS', lang), value: 'COPS' },
                { name: this.i18n.service.translate('WOS_COPS', lang), value: 'WOS_COPS' }
              ],
              matchMode: 'arrayContains'
            },
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
          },
          {
            field: 'startDate',
            header: this.i18n.service.translate('Start date', lang),
            pipe: 'date',
            pipeParam: lang === FR_CA ? 'd MMM yyyy' : 'MMM dd, yyyy',
          },
          {
            field: 'launchDate',
            header: this.i18n.service.translate('Launch date', lang),
            pipe: 'date',
            pipeParam: lang === FR_CA ? 'd MMM YYYY' : 'MMM dd, YYYY',
          },
          {
            field: 'lastAvgSuccessRate',
            header: this.i18n.service.translate('Average success rate', lang),
            pipe: 'percent',
            tooltip: 'tooltip-avg_success_last_uxtest'
          },
        ];
      },
    );
  }
}
