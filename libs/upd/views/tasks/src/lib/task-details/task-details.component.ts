import { Component, computed, inject, OnInit } from '@angular/core';
import { TasksDetailsFacade } from './+state/tasks-details.facade';
import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA } from '@dua-upd/upd/i18n';
import type { ColumnConfig } from '@dua-upd/types-common';
import { toSignal } from '@angular/core/rxjs-interop';
import { globalColours, getOptimalTextcolour } from '@dua-upd/utils-common';

type HighDemandMetric = 'visits' | 'calls' | 'dyf_no';

type RankMetric = {
  key: HighDemandMetric;
  label: string;
  value: number;
  highDemand: boolean;
};

@Component({
  selector: 'upd-task-details',
  templateUrl: './task-details.component.html',
  styleUrls: ['./task-details.component.scss'],
  standalone: false,
})
export class TaskDetailsComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly taskDetailsService = inject(TasksDetailsFacade);

  title$ = this.taskDetailsService.titleHeader$;
  error$ = this.taskDetailsService.error$;
  loading$ = this.taskDetailsService.loading$;

  currentRoute$ = this.taskDetailsService.currentRoute$;

  projects$ = this.taskDetailsService.projects$;

  currentLang = this.i18n.currentLang;
  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));

  colours = globalColours;
  getOptimalTextColour = getOptimalTextcolour;

  taskHeader = toSignal(this.taskDetailsService.taskHeader$, {
    initialValue: null
  });
  tmfRank = toSignal(this.taskDetailsService.tmfRank$);
  tmfTotalTasks = toSignal(this.taskDetailsService.tmfTotalTasks$);

  callsVolume = toSignal(this.taskDetailsService.currentCallVolume$);
  feedbackVolume = toSignal(this.taskDetailsService.dyfNo$);
  visitsVolume = toSignal(this.taskDetailsService.visits$);

  isHighDemand = toSignal(this.taskDetailsService.isHighDemand$);
  highDemandMetrics = toSignal(this.taskDetailsService.highDemandMetrics$);

  readonly rankMetrics = computed<RankMetric[]>(() => {
    const highDemandMetrics = new Set(this.highDemandMetrics());

    return [
      {
        key: 'visits',
        label: 'Visits',
        value: this.visitsVolume() ?? 0,
        highDemand: highDemandMetrics.has('visits'),
      },
      {
        key: 'calls',
        label: 'calls',
        value: this.callsVolume() ?? 0,
        highDemand: highDemandMetrics.has('calls'),
      },
      {
        key: 'dyf_no',
        label: 'Negative feedback',
        value: this.feedbackVolume() ?? 0,
        highDemand: highDemandMetrics.has('dyf_no'),
      },
    ];
  });

  navTabs = computed<{ href: string; title: string }[]>(() => {
    const lang = this.currentLang();

    const translate = (key: string) => this.i18n.service.translate(key, lang);

    return [
      {
        href: 'summary',
        title: translate('tab-summary'),
      },
      {
        href: 'webtraffic',
        title: translate('tab-webtraffic'),
      },
      {
        href: 'searchanalytics',
        title: translate('tab-searchanalytics'),
      },
      {
        href: 'pagefeedback',
        title: translate('tab-pagefeedback'),
      },
      {
        href: 'calldrivers',
        title: translate('tab-calldrivers'),
      },
      {
        href: 'uxtests',
        title: translate('tab-uxtests'),
      },
      {
        href: 'details',
        title: translate('tab-details'),
      },
    ];
  });

  projectsCol = computed<ColumnConfig>(() => ({
    field: 'title',
    header: 'project',
    type: 'link',
    translate: true,
    typeParams: {
      preLink: `/${this.langLink()}/projects`,
      link: '_id',
    },
  }));

  ngOnInit() {
    this.taskDetailsService.init();
  }
}
