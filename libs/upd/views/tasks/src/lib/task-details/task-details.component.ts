import { Component, computed, inject, OnInit } from '@angular/core';
import { TasksDetailsFacade } from './+state/tasks-details.facade';
import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA } from '@dua-upd/upd/i18n';
import type { ColumnConfig } from '@dua-upd/types-common';
import { toSignal } from '@angular/core/rxjs-interop';
import { globalColours, getOptimalTextcolour } from '@dua-upd/utils-common';

@Component({
    selector: 'upd-task-details',
    templateUrl: './task-details.component.html',
    styleUrls: ['./task-details.component.css'],
    standalone: false
})
export class TaskDetailsComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly taskDetailsService = inject(TasksDetailsFacade);

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

  title$ = this.taskDetailsService.titleHeader$;
  error$ = this.taskDetailsService.error$;
  loading$ = this.taskDetailsService.loading$;

  currentRoute$ = this.taskDetailsService.currentRoute$;

  navTabs: { href: string; title: string }[] = [];

  projects$ = this.taskDetailsService.projects$;
  projectsCol: ColumnConfig = { field: '', header: '' };

  colours = globalColours;
  getOptimalTextColour = getOptimalTextcolour;
  
  taskHeader = toSignal(this.taskDetailsService.taskHeader$);
  
  audience = computed(() => {
    return this.taskHeader()?.audience ?? [];
  });
  service = computed(() => {
    return this.taskHeader()?.service ?? [];
  });

  ngOnInit() {
    this.taskDetailsService.init();

    this.currentLang$.subscribe((lang) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';
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
          href: 'details',
          title: this.i18n.service.translate('tab-details', lang),
        },
      ];

      this.projectsCol = {
        field: 'title',
        header: 'project',
        type: 'link',
        translate: true,
        typeParams: {
          preLink: '/' + this.langLink + '/projects',
          link: '_id',
        },
      } as ColumnConfig;
    });
  }
}
