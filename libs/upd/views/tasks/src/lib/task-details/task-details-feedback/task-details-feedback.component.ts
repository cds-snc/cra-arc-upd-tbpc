import { Component, computed, inject, OnInit } from '@angular/core';
import type {
  ColumnConfig,
  FeedbackWithScores,
  WordRelevance,
} from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { TasksDetailsFacade } from '../+state/tasks-details.facade';
import { EN_CA } from '@dua-upd/upd/i18n';
import { combineLatest } from 'rxjs';

@Component({
    selector: 'upd-task-details-feedback',
    templateUrl: './task-details-feedback.component.html',
    styleUrls: ['./task-details-feedback.component.css'],
    standalone: false
})
export class TaskDetailsFeedbackComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly taskDetailsService = inject(TasksDetailsFacade);

  currentLang$ = this.i18n.currentLang$;
  langLink = 'en';

  fullDateRangeLabel$ = this.taskDetailsService.fullDateRangeLabel$;
  fullComparisonDateRangeLabel$ =
    this.taskDetailsService.fullComparisonDateRangeLabel$;

  visitsByPage$ = this.taskDetailsService.visitsByPage$;
  visitsByPageCols: ColumnConfig[] = [];

  dyfChart$ = this.taskDetailsService.dyfData$;

  dyfTableCols: ColumnConfig<{
    name: string;
    currValue: number;
    prevValue: number;
  }>[] = [];

  feedbackTotalComments$ = this.taskDetailsService.feedbackTotalComments$;

  feedbackTotalCommentsPercentChange$ =
    this.taskDetailsService.feedbackTotalCommentsPercentChange$;

  feedbackByDay$ = this.taskDetailsService.feedbackByDay$;
  feedbackByDayCols: ColumnConfig[] = [
    {
      field: 'date',
      header: 'date',
      pipe: 'date',
      translate: true,
    },
    {
      field: 'sum',
      header: 'Number of comments',
      pipe: 'number',
      translate: true,
    },
  ];

  dateRangeLabel$ = this.taskDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.taskDetailsService.comparisonDateRangeLabel$;

  dyfChartApex$ = this.taskDetailsService.dyfDataApex$;
  dyfChartLegend: string[] = [];

  feedbackMostRelevant = this.taskDetailsService.feedbackMostRelevant;

  mostRelevantCommentsEn = computed(
    () => this.feedbackMostRelevant()?.en.comments,
  );
  mostRelevantWordsEn = computed(() => this.feedbackMostRelevant().en.words);

  mostRelevantCommentsFr = computed(
    () => this.feedbackMostRelevant().fr.comments,
  );
  mostRelevantWordsFr = computed(() => this.feedbackMostRelevant().fr.words);

  mostRelevantCommentsColumns: ColumnConfig<FeedbackWithScores>[] = [
    {
      field: 'rank',
      header: 'Rank',
      width: '10px',
      center: true,
      frozen: true,
    },
    {
      field: 'date',
      header: 'Date',
      pipe: 'date',
      width: '100px',
      frozen: true,
    },
    { field: 'url', header: 'URL' },
    { field: 'owners', header: 'Area', width: '10px', hide: true },
    { field: 'sections', header: 'Section', hide: true },
    { field: 'comment', header: 'comment', width: '400px', frozen: true },
  ];

  mostRelevantWordsColumns: ColumnConfig<WordRelevance>[] = [
    { field: 'word', header: 'word', width: '10px' },
    {
      field: 'word_occurrences',
      header: 'Term occurrences',
      pipe: 'number',
      width: '10px',
    },
    {
      field: 'comment_occurrences',
      header: 'Comment occurrences',
      pipe: 'number',
      width: '10px',
    },
    // {
    //   field: 'page_occurrences',
    //   header: 'Page occurrences',
    //   pipe: 'number',
    //   width: '10px',
    // },
  ];

  getMostRelevantFeedback() {
    this.taskDetailsService.getMostRelevantFeedback();
  }

  ngOnInit() {
    combineLatest([
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
      this.currentLang$,
    ]).subscribe(([dateRange, comparisonDateRange, lang]) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';

      this.dyfChartLegend = [
        this.i18n.service.translate('yes', lang),
        this.i18n.service.translate('no', lang),
      ];

      this.visitsByPageCols = [
        {
          field: 'url',
          header: this.i18n.service.translate('URL', lang),
          type: 'link',
          typeParams: { preLink: `/${this.langLink}/pages`, link: '_id' },
        },
        {
          field: 'owners',
          header: this.i18n.service.translate('Area', lang),
          hide: true,
          translate: true,
        },
        {
          field: 'sections',
          header: this.i18n.service.translate('Section', lang),
          hide: true,
          translate: true,
        },
        {
          field: 'dyfYes',
          header: this.i18n.service.translate('yes', lang),
          pipe: 'number',
          type: 'link',
          typeParams: {
            preLink: '/' + this.langLink + '/pages',
            link: '_id',
            postLink: 'pagefeedback',
          },
        },
        {
          field: 'dyfNo',
          header: this.i18n.service.translate('no', lang),
          pipe: 'number',
          type: 'link',
          typeParams: {
            preLink: '/' + this.langLink + '/pages',
            link: '_id',
            postLink: 'pagefeedback',
          },
        },
        {
          field: 'dyfNoPercentChange',
          header: this.i18n.service.translate('change-for-No-answer', lang),
          pipe: 'percent',
        },
        {
          field: 'feedbackToVisitsRatio',
          header: this.i18n.service.translate(
            'Ratio of feedback to visits',
            lang,
          ),
          pipe: 'percent',
          pipeParam: '1.2',
        },
        {
          field: 'numComments',
          header: '# of comments',
          pipe: 'number',
        },
        {
          field: 'numCommentsPercentChange',
          header: 'change-for-comments',
          pipe: 'percent',
        },
      ];

      this.dyfTableCols = [
        {
          field: 'name',
          header: this.i18n.service.translate('Selection', lang),
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
