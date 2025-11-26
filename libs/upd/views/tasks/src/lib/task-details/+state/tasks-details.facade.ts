import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, map } from 'rxjs';
import dayjs from 'dayjs/esm';
import utc from 'dayjs/esm/plugin/utc';
import 'dayjs/esm/locale/en-ca';
import 'dayjs/esm/locale/fr-ca';
import { I18nFacade, selectRoute } from '@dua-upd/upd/state';
import { FR_CA, type LocaleId } from '@dua-upd/upd/i18n';
import type {
  AttachmentData,
  TaskDetailsData,
  ColumnConfig,
} from '@dua-upd/types-common';
import {
  type GetTableProps,
  type KeysOfType,
  percentChange,
  type UnwrapObservable,
} from '@dua-upd/utils-common';
import * as TasksDetailsActions from './tasks-details.actions';
import * as TasksDetailsSelectors from './tasks-details.selectors';
import { createColConfigWithI18n } from '@dua-upd/upd/utils';
import type { ApexAxisChartSeries } from 'ng-apexcharts';
import {
  selectCallsPerVisitsChartData,
  selectDyfNoPerVisitsSeries,
  selectTasksDetailsDataWithI18n,
} from './tasks-details.selectors';

dayjs.extend(utc);

type CallsByTopicTableType = GetTableProps<TasksDetailsFacade, 'callsByTopic$'>;

@Injectable()
export class TasksDetailsFacade {
  private i18n = inject(I18nFacade);
  private readonly store = inject(Store);

  loaded$ = this.store.select(TasksDetailsSelectors.selectTasksDetailsLoaded);
  loading$ = this.store.select(TasksDetailsSelectors.selectTasksDetailsLoading);
  tasksDetailsData$ = this.store.select(
    TasksDetailsSelectors.selectTasksDetailsData,
  );

  currentLang$ = this.i18n.currentLang$;

  currentRoute$ = this.store.select(selectRoute);

  titleHeader$ = this.getTranslatedProp('title');

  taskHeader$ = this.store.select(selectTasksDetailsDataWithI18n).pipe(
    map(([data, lang]) => {
      const translateAndSortAudience = (values?: string | string[]): { text: string; index: number }[] => {
        if (!values) return [];
        if (!Array.isArray(values)) return [{ text: this.i18n.service.translate(values, lang), index: 0 }];
  
        return values
          .map((val, i) => ({ text: this.i18n.service.translate(val, lang), index: i }))
          .sort((a, b) => a.text.localeCompare(b.text));
      };
  
      const translateAndSortService = (values?: string | string[]): string[] => {
        if (!values) return [];
        if (!Array.isArray(values)) return [this.i18n.service.translate(values, lang)];
  
        return values
          .map((val) => this.i18n.service.translate(val, lang))
          .sort((a, b) => a.localeCompare(b));
      };
  
      return {
        audience: translateAndSortAudience(data?.user_type),
        service: translateAndSortService(data?.service),
      };
    })
  );

  detailsTable$ = this.store.select(selectTasksDetailsDataWithI18n).pipe(
    map(([data, lang]) => {
      const detailsFieldNames = [
        'group',
        'subgroup',
        'topic',
        'subtopic',
        'channel',
        'core',
        'program',
        'service',
        'user_journey',
        'status',
        'user_type',
      ] as const;

      return detailsFieldNames.map((fieldName) => {
        const value = data?.[fieldName];

        if (Array.isArray(value)) {
          return [
            this.i18n.service.translate(fieldName, lang),
            value
              .map((valItem) => this.i18n.service.translate(valItem, lang))
              .join(', '),
          ];
        }

        return [
          this.i18n.service.translate(fieldName, lang),
          value ? this.i18n.service.translate(value, lang) : value,
        ];
      });
    }),
  );

  avgTaskSuccessFromLastTest$ = this.tasksDetailsData$.pipe(
    map((data) => data?.avgTaskSuccessFromLastTest),
  );

  avgSuccessPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.avgSuccessPercentChange),
  );

  avgSuccessValueChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.avgSuccessValueChange),
  );

  dateFromLastTest$ = this.tasksDetailsData$.pipe(
    map((data) =>
      data?.dateFromLastTest
        ? new Date(data?.dateFromLastTest)
        : data?.dateFromLastTest,
    ),
  );

  visits$ = this.tasksDetailsData$.pipe(map((data) => data?.visits || 0));
  visitsPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.visitsPercentChange),
  );

  visitsByPage$ = combineLatest([
    this.tasksDetailsData$,
    this.i18n.currentLang$,
  ]).pipe(
    map(([{ visitsByPage }, currentLang]) =>
      visitsByPage?.map((pageMetrics) => ({
        ...pageMetrics,
        language: this.i18n.service.translate(
          pageMetrics.language,
          currentLang,
        ),
      })),
    ),
  );

  feedbackByDay$ = this.tasksDetailsData$.pipe(
    map((data) => {
      const feedbackByDayData = data?.feedbackByDay || [];

      return feedbackByDayData.every((v) => v.numComments === 0)
        ? []
        : feedbackByDayData.map(({ date, numComments }) => ({
            date,
            sum: numComments,
          }));
    }),
  );

  apexCallDrivers$ = this.store.select(selectCallsPerVisitsChartData);
  apexKpiFeedback$ = this.store.select(selectDyfNoPerVisitsSeries);

  totalCalldriver$ = this.tasksDetailsData$.pipe(
    map((data) => data?.totalCalls || 0),
  );

  totalCalldriverPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.totalCallsPercentChange || 0),
  );

  callPerVisits$ = this.tasksDetailsData$.pipe(
    map((data) => {
      return data?.callsPer100Visits || 0;
    }),
  );

  apexCallPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.callsPer100VisitsPercentChange),
  );

  apexCallDifference$ = this.tasksDetailsData$.pipe(
    map((data) => data?.callsPer100VisitsDifference),
  );

  currentKpiFeedback$ = this.tasksDetailsData$.pipe(
    map((data) => {
      return data?.dyfNoPer1000Visits || 0;
    }),
  );

  kpiFeedbackPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => {
      return data?.dyfNoPer1000VisitsPercentChange || 0;
    }),
  );

  kpiFeedbackDifference$ = this.tasksDetailsData$.pipe(
    map((data) => {
      return data?.dyfNoPer1000VisitsDifference || 0;
    }),
  );

  projects$ = combineLatest([this.tasksDetailsData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      return (
        data?.projects?.map(({ _id, title }) => ({
          _id,
          title: this.i18n.service.translate(title, lang),
        })) || []
      );
    }),
  );

  documents$ = this.tasksDetailsData$.pipe(
    map((data) =>
      data?.projects
        .reduce(
          (attachments, project) => [
            ...attachments,
            ...(project.attachments || []),
          ],
          [] as AttachmentData[],
        )
        .map((attachment) => ({
          url: attachment.storage_url,
          filename: attachment.filename,
        })),
    ),
  );

  dateRangeLabel$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) => this.getDateRangeLabel(data.dateRange, lang) as string,
    ),
  );

  comparisonDateRangeLabel$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(data.comparisonDateRange || '', lang) as string,
    ),
  );

  fullDateRangeLabel$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(
          data.dateRange,
          lang,
          'MMM D YYYY',
          'to',
          true,
        ) as string[],
    ),
  );

  fullComparisonDateRangeLabel$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(
          data.comparisonDateRange || '',
          lang,
          'MMM D YYYY',
          'to',
          true,
        ) as string[],
    ),
  );

  calldriversChart$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dateRangeLabel = this.getDateRangeLabel(data.dateRange || '', lang);
      const comparisonDateRangeLabel = this.getDateRangeLabel(
        data.comparisonDateRange || '',
        lang,
      );

      const dataEnquiryLine = (
        data?.dateRangeData?.calldriversEnquiry || []
      ).map((d) => ({
        name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
        value: d.calls,
      }));

      const comparisonDataEnquiryLine = (
        data?.comparisonDateRangeData?.calldriversEnquiry || []
      ).map((d) => ({
        name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
        value: d.calls,
      }));

      const isCurrZero = dataEnquiryLine.every((v) => v.value === 0);
      const isPrevZero = comparisonDataEnquiryLine.every((v) => v.value === 0);

      if (isCurrZero && isPrevZero) {
        return [];
      }

      const dataEnquiryLineFinal = dataEnquiryLine.filter((v) => v.value > 0);
      const comparisonDataEnquiryLineFinal = comparisonDataEnquiryLine.filter(
        (v) => v.value > 0,
      );

      const barChartData = [
        {
          name: dateRangeLabel,
          series: dataEnquiryLineFinal,
        },
        {
          name: comparisonDateRangeLabel,
          series: comparisonDataEnquiryLineFinal,
        },
      ];

      return barChartData;
    }),
  );

  calldriversTable$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dateRange = data?.dateRangeData?.calldriversEnquiry || [];
      const comparisonDateRange =
        data?.comparisonDateRangeData?.calldriversEnquiry || [];

      const dataEnquiryLine = dateRange.map((d) => {
        let prevVal = NaN;
        comparisonDateRange.map((cd) => {
          if (d.enquiry_line === cd.enquiry_line) {
            prevVal = cd.calls;
          }
        });
        return {
          name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
          currValue: d.calls,
          prevValue: prevVal,
        };
      });

      comparisonDateRange.map((d) => {
        let currVal = 0;
        dateRange.map((cd) => {
          if (d.enquiry_line === cd.enquiry_line) {
            currVal = cd.calls;
          }
        });
        if (currVal === 0) {
          dataEnquiryLine.push({
            name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
            currValue: 0,
            prevValue: d.calls,
          });
        }
      });
      return dataEnquiryLine.filter((v) => v.currValue > 0 || v.prevValue > 0);
    }),
  );

  apexCalldriversChart$ = combineLatest([this.calldriversTable$]).pipe(
    map(([data]) => {
      return data.map((d) => {
        return {
          name: d.name,
          data: [d.currValue, d.prevValue],
        };
      });
    }),
  );

  dyfData$ = combineLatest([this.tasksDetailsData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      const yes = this.i18n.service.translate('yes', lang);
      const no = this.i18n.service.translate('no', lang);

      const currYesVal = data?.dateRangeData?.dyfYes || 0;
      const prevYesVal = data?.comparisonDateRangeData?.dyfYes || NaN;
      const currNoVal = data?.dateRangeData?.dyfNo || 0;
      const prevNoVal = data?.comparisonDateRangeData?.dyfNo || NaN;

      const pieChartData = [
        { name: yes, currValue: currYesVal, prevValue: prevYesVal },
        { name: no, currValue: currNoVal, prevValue: prevNoVal },
      ];

      const filteredPieChartData = pieChartData.filter(
        (v) => v.currValue > 0 || v.prevValue > 0,
      );

      return filteredPieChartData.length > 0 ? filteredPieChartData : [];
    }),
  );

  dyfDataApex$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dyfData: ApexAxisChartSeries = [
        {
          name: this.i18n.service.translate('yes', lang),
          data: [
            data?.dateRangeData?.dyfYes || 0,
            data?.comparisonDateRangeData?.dyfYes || 0,
          ],
        },
        {
          name: this.i18n.service.translate('no', lang),
          data: [
            data?.dateRangeData?.dyfNo || 0,
            data?.comparisonDateRangeData?.dyfNo || 0,
          ],
        },
      ];

      const isZero = dyfData.every((item) =>
        (item.data as number[]).every(
          (value) => typeof value === 'number' && value === 0,
        ),
      );

      if (isZero) {
        return [];
      }

      return dyfData;
    }),
  );

  callsByTopic$ = this.tasksDetailsData$.pipe(
    map((data) => data?.callsByTopic),
  );
  hasTopicIds$ = this.tasksDetailsData$.pipe(
    map((data) => data?.tpc_ids.length > 0),
  );

  callsByTopicConfig$ = createColConfigWithI18n<CallsByTopicTableType>(
    this.i18n.service,
    [
      {
        field: 'tpc_id',
        header: 'tpc_id',
        translate: true,
      },
      {
        field: 'enquiry_line',
        header: 'enquiry_line',
        translate: true,
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
        field: 'calls',
        header: 'calls',
        pipe: 'number',
      },
      {
        field: 'callsPercentChange',
        header: 'change',
        pipe: 'percent',
        pipeParam: '1.0-2',
        upGoodDownBad: false,
        indicator: true,
        useArrows: true,
        showTextColours: true,
        secondaryField: {
          field: 'callsDifference',
          pipe: 'number',
        },
        width: '160px',
      },
    ] as ColumnConfig<UnwrapObservable<typeof this.callsByTopic$>>[],
  );

  currentCallVolume$ = this.tasksDetailsData$.pipe(
    map(
      (data) =>
        data?.dateRangeData?.calldriversEnquiry.reduce(
          (totalCalls, enquiryLineCalls) => totalCalls + enquiryLineCalls.calls,
          0,
        ) || 0,
    ),
  );

  comparisonCallVolume$ = this.tasksDetailsData$.pipe(
    map(
      (data) =>
        data?.comparisonDateRangeData?.calldriversEnquiry.reduce(
          (totalCalls, enquiryLineCalls) => totalCalls + enquiryLineCalls.calls,
          0,
        ) || 0,
    ),
  );
  callPercentChange$ = combineLatest([
    this.currentCallVolume$,
    this.comparisonCallVolume$,
  ]).pipe(
    map(([currentCalls, comparisonCalls]) =>
      percentChange(currentCalls, comparisonCalls),
    ),
  );

  taskSuccessChart$ = this.tasksDetailsData$.pipe(
    map((data) => {
      const taskSuccessByUxTest = data?.taskSuccessByUxTest;
      const tasksWithSuccessRate = taskSuccessByUxTest?.filter(
        (task) => task.success_rate || task.success_rate === 0,
      );

      if (!taskSuccessByUxTest || !tasksWithSuccessRate.length) {
        return [];
      }

      return taskSuccessByUxTest.map(({ title, success_rate }, idx) => ({
        name: `UX Test: ${idx + 1} - ${title}`,
        value: success_rate || 0,
      }));
    }),
  );

  taskSuccessChartData$ = this.tasksDetailsData$.pipe(
    map((data) => {
      if (
        !data?.taskSuccessByUxTest?.filter(
          (task) => task.success_rate || task.success_rate === 0,
        )?.length
      ) {
        return [];
      }
      return [
        {
          data: data?.taskSuccessByUxTest.map(
            ({ success_rate }) => success_rate || 0,
          ),
        },
      ] as ApexAxisChartSeries;
    }),
  );

  taskSuccessChartLegend$ = this.tasksDetailsData$.pipe(
    map((data) => {
      const taskSuccessByUxTest = data?.taskSuccessByUxTest;
      const tasksWithSuccessRate = taskSuccessByUxTest?.filter(
        (task) => task.success_rate || task.success_rate === 0,
      );

      if (!taskSuccessByUxTest || !tasksWithSuccessRate.length) {
        return [];
      }

      return taskSuccessByUxTest.map(
        ({ title }, idx) => `UX Test: ${idx + 1} - ${title}`,
      );
    }),
  );

  taskSuccessChartHeight$ = this.taskSuccessChartLegend$.pipe(
    map((legend) => legend.length * 35 + 100),
  );

  gscTotalClicks$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalClicks || 0),
  );
  gscTotalClicksPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalClicksPercentChange),
  );

  gscTotalImpressions$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalImpressions || 0),
  );
  gscTotalImpressionsPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalImpressionsPercentChange),
  );

  gscTotalCtr$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalCtr || 0),
  );
  gscTotalCtrPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalCtrPercentChange),
  );

  gscTotalPosition$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalPosition || 0),
  );
  gscTotalPositionPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.gscTotalPositionPercentChange),
  );

  taskSuccessByUxTest$ = combineLatest([
    this.tasksDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const uxTests = data?.taskSuccessByUxTest;

      const maxTotalUsersByTitle = uxTests?.reduce<Record<string, number>>(
        (acc, test) => {
          acc[test.title] = Math.max(
            acc[test.title] || 0,
            test.total_users || 0,
          );
          return acc;
        },
        {},
      );

      const totalSum = Object.values(maxTotalUsersByTitle || {}).reduce(
        (sum, val) => sum + val,
        0,
      );

      const taskSuccessByUxTest = uxTests?.map((d) => ({
        ...d,
        title: d.title ? this.i18n.service.translate(d.title, lang) : d.title,
        test_type: d.test_type
          ? this.i18n.service.translate(d.test_type, lang)
          : d.test_type,
        date: d.date,
        total_users: totalSum,
        scenario: d.scenario,
      }));
      return [...(taskSuccessByUxTest || [])];
    }),
  );

  totalParticipants$ = this.tasksDetailsData$.pipe(
    map((data) => {
      const uxTests = data?.taskSuccessByUxTest || [];

      const maxTotalUsersByValidation = uxTests.reduce<Record<string, number>>(
        (acc, test) => {
          if (test.test_type === 'Validation') {
            acc[test.title] = Math.max(
              acc[test.title] || 0,
              test.total_users || 0,
            );
          }
          return acc;
        },
        {},
      );

      const maxTotalUsersByNonValidation = uxTests.reduce<
        Record<string, number>
      >((acc, test) => {
        if (test.test_type !== 'Validation') {
          acc[test.title] = Math.max(
            acc[test.title] || 0,
            test.total_users || 0,
          );
        }
        return acc;
      }, {});
      const validationSum = Object.values(maxTotalUsersByValidation).reduce(
        (sum, val) => sum + val,
        0,
      );

      const nonValidationSum = Object.values(
        maxTotalUsersByNonValidation,
      ).reduce((sum, val) => sum + val, 0);

      return validationSum + nonValidationSum;
    }),
  );

  feedbackTotalComments$ = this.tasksDetailsData$.pipe(
    map((data) => data?.numComments || 0),
  );

  feedbackTotalCommentsPercentChange$ = this.tasksDetailsData$.pipe(
    map((data) => data?.numCommentsPercentChange),
  );

  topSearchTerms$ = this.tasksDetailsData$.pipe(
    map((data) => data?.searchTerms),
  );

  searchTermsColConfig$ = createColConfigWithI18n<
    UnwrapObservable<typeof this.topSearchTerms$>
  >(this.i18n.service, [
    { field: 'term', header: 'search-term' },
    { field: 'clicks', header: 'clicks', pipe: 'number' },
    { field: 'clicksChange', header: 'change-for-clicks', pipe: 'percent' },
    {
      field: 'position',
      header: 'position',
      pipe: 'number',
      pipeParam: '1.0-2',
    },
  ]);

  getDateRangeLabel(
    dateRange: string,
    lang: LocaleId,
    dateFormat = 'MMM D YYYY',
    separator = '-',
    breakLine = false,
  ) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    dateFormat = this.i18n.service.translate(dateFormat, lang);
    separator = this.i18n.service.translate(separator, lang);

    const formattedStartDate = dayjs
      .utc(startDate)
      .locale(lang)
      .format(dateFormat);
    const formattedEndDate = dayjs.utc(endDate).locale(lang).format(dateFormat);

    //breakLine exists for apexcharts labels
    return breakLine
      ? [`${formattedStartDate} ${separator}`, `${formattedEndDate}`]
      : `${formattedStartDate} ${separator} ${formattedEndDate}`;
  }

  error$ = this.store.select(TasksDetailsSelectors.selectTasksDetailsError);

  feedbackCommentsAndWords = this.store.selectSignal(
    TasksDetailsSelectors.selectFeedbackCommentsAndWords,
  );

  getCommentsAndWords() {
    this.store.dispatch(TasksDetailsActions.getCommentsAndWords());
  }

  /**
   * Use the initialization action to perform one
   * or more tasks in your Effects.
   */
  init() {
    this.store.dispatch(TasksDetailsActions.loadTasksDetailsInit());
  }

  getTranslatedProp(propName: KeysOfType<TaskDetailsData, string>) {
    return this.store
      .select(selectTasksDetailsDataWithI18n)
      .pipe(
        map(([data, lang]) =>
          data?.[propName]
            ? this.i18n.service.translate(data[propName], lang)
            : data?.[propName],
        ),
      );
  }
}
