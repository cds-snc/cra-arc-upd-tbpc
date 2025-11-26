import { Component, computed, inject, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import type {
  ColumnConfig,
  FeedbackBase,
  FeedbackWord,
} from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA } from '@dua-upd/upd/i18n';
import type { GetTableProps } from '@dua-upd/utils-common';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';

type VisitsByPageColType = GetTableProps<
  ProjectDetailsFeedbackComponent,
  'visitsByPage$'
>;

@Component({
    selector: 'upd-project-details-feedback',
    templateUrl: './project-details-feedback.component.html',
    styleUrls: ['./project-details-feedback.component.css'],
    standalone: false
})
export class ProjectDetailsFeedbackComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private readonly projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang$ = this.i18n.currentLang$;

  langLink = 'en';

  fullDateRangeLabel$ = this.projectsDetailsService.fullDateRangeLabel$;

  fullComparisonDateRangeLabel$ =
    this.projectsDetailsService.fullComparisonDateRangeLabel$;

  visitsByPage$ =
    this.projectsDetailsService.visitsByPageFeedbackWithPercentChange$;

  visitsByPageCols: ColumnConfig<VisitsByPageColType>[] = [];

  dyfChart$ = this.projectsDetailsService.dyfData$;

  dyfTableCols: ColumnConfig<{
    name: string;
    currValue: number;
    prevValue: string;
  }>[] = [];

  dyfChartApex$ = this.projectsDetailsService.dyfDataApex$;
  dyfChartLegend: string[] = [];

  feedbackTotalComments$ = this.projectsDetailsService.feedbackTotalComments$;
  commentsPercentChange$ = this.projectsDetailsService.commentsPercentChange$;

  dateRangeLabel$ = this.projectsDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ =
    this.projectsDetailsService.comparisonDateRangeLabel$;

  feedbackCommentsAndWords =
    this.projectsDetailsService.feedbackCommentsAndWords;

  feedbackByDay$ = this.projectsDetailsService.feedbackByDay$;
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

  commentsEn = computed(() => this.feedbackCommentsAndWords().en.comments);
  wordsEn = computed(() => this.feedbackCommentsAndWords().en.words);

  commentsFr = computed(() => this.feedbackCommentsAndWords().fr.comments);
  wordsFr = computed(() => this.feedbackCommentsAndWords().fr.words);

  commentsColumns: ColumnConfig<FeedbackBase>[] = [
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
    { field: 'tasks', header: 'Task' },
    { field: 'comment', header: 'comment', width: '400px', frozen: true },
  ];

  wordsColumns: ColumnConfig<FeedbackWord>[] = [
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
          typeParams: { preLink: '/' + this.langLink + '/pages', link: '_id' },
        },
        {
          field: 'owners',
          header: this.i18n.service.translate('Area', lang),
          hide: true,
        },
        {
          field: 'sections',
          header: this.i18n.service.translate('Section', lang),
          hide: true,
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
          field: 'sum',
          header: 'Number of comments',
          pipe: 'number',
        },
        {
          field: 'commentsPercentChange',
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
