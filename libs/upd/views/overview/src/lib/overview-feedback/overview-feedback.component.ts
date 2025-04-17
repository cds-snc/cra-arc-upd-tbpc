import { Component, computed, inject, Signal } from '@angular/core';
import type {
  ColumnConfig,
  FeedbackWithScores,
  OverviewFeedback,
  WordRelevance,
} from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import {
  selectOverviewFeedbackLoading,
  selectOverviewFeedbackError,
  selectOverviewFeedbackData,
} from './+state/overview-feedback.selectors';
import { OverviewFacade } from '../+state/overview/overview.facade';
import { round } from '@dua-upd/utils-common';

@Component({
  selector: 'upd-overview-feedback',
  templateUrl: './overview-feedback.component.html',
  styleUrls: ['./overview-feedback.component.css'],
})
export class OverviewFeedbackComponent {
  private overviewService = inject(OverviewFacade);
  private readonly store = inject(Store);
  private i18n = inject(I18nFacade);

  loading = this.store.selectSignal(selectOverviewFeedbackLoading);

  error = this.store.selectSignal(selectOverviewFeedbackError);

  data = toSignal(
    this.store
      .select(selectOverviewFeedbackData)
      .pipe(filter((data) => !!data)),
  ) as Signal<OverviewFeedback>;

  commentsByPage = computed(() => this.data().commentsByPage);

  feedbackByDay = computed(() => this.data().feedbackByDay);

  currentTotalComments = computed(() => this.data().numComments);

  commentsPercentChange = computed(() => this.data().numCommentsPercentChange);

  feedbackMostRelevant = computed(
    () => this.data().mostRelevantCommentsAndWords,
  );

  avgCommentsByDay = computed(() => {
    const total = this.currentTotalComments();
    const totalDays = this.feedbackByDay().length || null;

    return totalDays ? round(total / totalDays, 0) : null;
  });

  avgCommentsByPage = computed(() => {
    const total = this.currentTotalComments();
    const totalPages = this.commentsByPage().length || 0;

    return totalPages ? round(total / totalPages, 0) : 0;
  });

  fullDateRangeLabel$ = this.overviewService.fullDateRangeLabel$;
  fullComparisonDateRangeLabel$ =
    this.overviewService.fullComparisonDateRangeLabel$;

  dateRangeLabel = toSignal(this.overviewService.dateRangeLabel$);
  comparisonDateRangeLabel = toSignal(
    this.overviewService.comparisonDateRangeLabel$,
  );

  dyfChart$ = this.overviewService.dyfData$;

  mostRelevantCommentsEn = computed(
    () => this.feedbackMostRelevant().en.comments,
  );
  mostRelevantWordsEn = computed(() => this.feedbackMostRelevant().en.words);

  mostRelevantCommentsFr = computed(
    () => this.feedbackMostRelevant().fr.comments,
  );
  mostRelevantWordsFr = computed(() => this.feedbackMostRelevant().fr.words);

  dyfChartApex$ = this.overviewService.dyfDataApex$;
  feedbackByDayCols: ColumnConfig<{
    date: string;
    sum: number;
  }>[] = [
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

  dyfTableCols: Signal<
    ColumnConfig<{
      name: string;
      currValue: number;
      prevValue: number;
    }>[]
  > = computed(() => [
    {
      field: 'name',
      header: 'Selection',
    },
    {
      field: 'currValue',
      header: this.dateRangeLabel() as string,
      pipe: 'number',
    },
    {
      field: 'prevValue',
      header: this.comparisonDateRangeLabel() as string,
      pipe: 'number',
    },
  ]);

  feedbackPagesTableCols: Signal<
    ColumnConfig<{
      _id: string;
      title: string;
      url: string;
      owners?: string;
      sections?: string;
      sum: number;
      percentChange: number | null;
    }>[]
  > = computed(() => [
    {
      field: 'url',
      header: 'page',
      type: 'link',
      typeParams: { link: 'url', external: true },
    },
    {
      field: 'owners',
      header: 'Area',
      translate: true,
    },
    {
      field: 'sections',
      header: 'Section',
      translate: true,
    },
    {
      field: 'sum',
      header: '# of comments',
      pipe: 'number',
      type: 'link',
      typeParams: {
        preLink: `/${this.i18n.currentLang().slice(0, 2)}/pages`,
        link: '_id',
        postLink: 'pagefeedback',
      },
    },
    {
      field: 'percentChange',
      header: 'change',
      pipe: 'percent',
    },
  ]);

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

  recalculateMostRelevant() {
    this.overviewService.getMostRelevantFeedback();
  }
}
