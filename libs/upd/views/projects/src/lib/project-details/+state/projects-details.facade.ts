import { inject, Injectable } from '@angular/core';
import type {
  CalldriversTableRow,
  ColumnConfig,
  ProjectDetailsAggregatedData,
  ProjectsDetailsData,
  TaskKpi,
  VisitsByPage,
} from '@dua-upd/types-common';
import { FR_CA, LocaleId } from '@dua-upd/upd/i18n';
import { I18nFacade, selectRoute } from '@dua-upd/upd/state';
import { createColConfigWithI18n } from '@dua-upd/upd/utils';

import {
  avg,
  type GetTableProps,
  percentChange,
  type PickByType,
  type UnwrapObservable,
  round,
  arrayToDictionary,
  isNullish,
  arrayToDictionaryMultiref,
} from '@dua-upd/utils-common';
import { Store } from '@ngrx/store';
import dayjs from 'dayjs/esm';
import 'dayjs/esm/locale/en-ca';
import 'dayjs/esm/locale/fr-ca';
import utc from 'dayjs/esm/plugin/utc';
import type { ApexAxisChartSeries } from 'ng-apexcharts';
import { combineLatest, map } from 'rxjs';
import * as ProjectsDetailsActions from './projects-details.actions';
import * as ProjectsDetailsSelectors from './projects-details.selectors';
import {
  selectCallsPerVisitsChartData,
  selectDyfNoPerVisitsSeries,
} from './projects-details.selectors';

dayjs.extend(utc);

type CallsByTopicTableType = GetTableProps<
  ProjectsDetailsFacade,
  'callsByTopic$'
>;

@Injectable()
export class ProjectsDetailsFacade {
  private i18n = inject(I18nFacade);
  private readonly store = inject(Store);

  loaded$ = this.store.select(
    ProjectsDetailsSelectors.selectProjectsDetailsLoaded,
  );

  loading$ = this.store.select(
    ProjectsDetailsSelectors.selectProjectsDetailsLoading,
  );

  projectsDetailsData$ = this.store.select(
    ProjectsDetailsSelectors.selectProjectsDetailsData,
  );

  currentLang$ = this.i18n.currentLang$;

  currentRoute$ = this.store.select(selectRoute);

  title$ = this.projectsDetailsData$.pipe(
    map((data) => data?.title.replace(/\s+/g, ' ')),
  );
  status$ = this.projectsDetailsData$.pipe(map((data) => data?.status));

  cops$ = this.projectsDetailsData$.pipe(map((data) => data?.cops));

  description$ = this.projectsDetailsData$.pipe(
    map((data) => data?.description),
  );

  avgTaskSuccessFromLastTest$ = this.projectsDetailsData$.pipe(
    map((data) => data?.avgTaskSuccessFromLastTest),
  );

  avgSuccessPercentChange$ = this.projectsDetailsData$.pipe(
    map((data) => data?.avgSuccessPercentChange),
  );

  avgSuccessValueChange$ = this.projectsDetailsData$.pipe(
    map((data) => data?.avgSuccessValueChange),
  );

  dateFromLastTest$ = this.projectsDetailsData$.pipe(
    map((data) =>
      data?.dateFromLastTest
        ? new Date(data?.dateFromLastTest)
        : data?.dateFromLastTest,
    ),
  );

  totalCalldriver$ = this.projectsDetailsData$.pipe(
    map((data) => data?.dateRangeData?.totalCalldrivers || 0),
  );

  comparisonTotalCalldriver$ = this.projectsDetailsData$.pipe(
    map((data) => data?.comparisonDateRangeData?.totalCalldrivers || 0),
  );

  apexCallDrivers$ = this.store.select(selectCallsPerVisitsChartData);
  apexKpiFeedback$ = this.store.select(selectDyfNoPerVisitsSeries);

  visits$ = this.projectsDetailsData$.pipe(
    map((data) => data?.dateRangeData?.visits || 0),
  );
  comparisonVisits$ = this.projectsDetailsData$.pipe(
    map((data) => data?.comparisonDateRangeData?.visits || 0),
  );

  visitsPercentChange$ = this.projectsDetailsData$.pipe(
    mapToPercentChange('visits'),
  );

  visitsByPage$ = this.projectsDetailsData$.pipe(
    map((data) => data?.dateRangeData?.visitsByPage),
  );

  visitsByPageWithPercentChange$ = combineLatest([
    this.projectsDetailsData$.pipe(
      mapPageMetricsArraysWithPercentChange('visitsByPage', 'visits'),
    ),
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const visitsByPage = data?.map((page) => {
        const language = page.url.includes('/en/')
          ? this.i18n.service.translate('English', lang)
          : this.i18n.service.translate('French', lang);
        return { ...page, language };
      });

      return [...(visitsByPage || [])];
    }),
  );

  visitsByPageGSCWithPercentChange$ = this.projectsDetailsData$.pipe(
    mapPageMetricsArraysWithPercentChange('visitsByPage', 'gscTotalClicks'),
  );

  feedbackByDay$ = this.projectsDetailsData$.pipe(
    map((data) => {
      const feedbackByDayData = data?.feedbackByDay || [];

      return feedbackByDayData.every((v) => v.sum === 0)
        ? []
        : feedbackByDayData;
    }),
  );

  visitsByPageFeedbackWithPercentChange$ = this.projectsDetailsData$.pipe(
    map((data) => {
      const feedbackByPageDict = arrayToDictionary(data?.feedbackByPage, '_id');

      const prevVisitsByPageDict = arrayToDictionary(
        data?.comparisonDateRangeData?.visitsByPage || [],
        '_id',
      );

      return (
        data.dateRangeData?.visitsByPage
          .map((page) => {
            const { sum, percentChange: commentsPercentChange } =
              feedbackByPageDict[page._id] || { sum: 0, percentChange: null };

            const prevDyfNo = prevVisitsByPageDict[page._id]?.dyfNo || 0;

            const dyfNoPercentChange = prevDyfNo
              ? percentChange(page.dyfNo || 0, prevDyfNo)
              : null;

            const merged = {
              ...page,
              sum,
              commentsPercentChange,
              dyfNoPercentChange,
            };

            const totalFeedback = (page.dyfYes || 0) + (page.dyfNo || 0);

            if (page.visits === 0 || totalFeedback === 0) {
              return merged;
            }

            return {
              ...merged,
              feedbackToVisitsRatio: totalFeedback / page.visits,
            };
          })
          .sort(
            (a, b) =>
              (b.dyfYes || 0) +
              (b.dyfNo || 0) -
              ((a.dyfYes || 0) + (a.dyfNo || 0)),
          ) || []
      );
    }),
  );

  totalCalldriverPercentChange$ = this.projectsDetailsData$.pipe(
    mapToPercentChange('totalCalldrivers'),
  );

  callPerVisits$ = combineLatest([this.totalCalldriver$, this.visits$]).pipe(
    map(([currentCalls, visits]) => {
      return currentCalls / visits;
    }),
  );

  callComparisonPerVisits$ = combineLatest([
    this.comparisonTotalCalldriver$,
    this.comparisonVisits$,
  ]).pipe(
    map(([comparisonCalls, comparisonVisits]) => {
      return comparisonCalls / comparisonVisits;
    }),
  );

  apexCallPercentChange$ = combineLatest([
    this.callPerVisits$,
    this.callComparisonPerVisits$,
  ]).pipe(
    map(([currentCalls, comparisonVisits]) =>
      percentChange(currentCalls, comparisonVisits),
    ),
  );

  apexCallDifference$ = combineLatest([
    this.callPerVisits$,
    this.callComparisonPerVisits$,
  ]).pipe(
    map(([currentCalls, comparisonVisits]) => currentCalls - comparisonVisits),
  );

  currentKpiFeedback$ = this.projectsDetailsData$.pipe(
    map((data) => {
      const dyfNoCurrent = data?.dateRangeData?.dyfNo || 0;
      const visits = data?.dateRangeData?.visits || 0;

      return dyfNoCurrent / visits;
    }),
  );

  comparisonKpiFeedback$ = combineLatest([this.projectsDetailsData$]).pipe(
    map(([data]) => {
      const dyfNoComparison = data?.comparisonDateRangeData?.dyfNo || 0;
      const visits = data?.comparisonDateRangeData?.visits || 0;

      return dyfNoComparison / visits;
    }),
  );

  kpiFeedbackPercentChange$ = combineLatest([
    this.currentKpiFeedback$,
    this.comparisonKpiFeedback$,
  ]).pipe(
    map(([currentKpi, comparisonKpi]) =>
      percentChange(currentKpi, comparisonKpi),
    ),
  );

  kpiFeedbackDifference$ = combineLatest([
    this.currentKpiFeedback$,
    this.comparisonKpiFeedback$,
  ]).pipe(map(([currentKpi, comparisonKpi]) => currentKpi - comparisonKpi));

  projectTasks$ = this.projectsDetailsData$.pipe(
    map((data) => data?.taskMetrics || []),
  );

  calldriversChart$ = combineLatest([
    this.projectsDetailsData$,
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
    this.projectsDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const currentData: { enquiry_line: string; calls: number }[] =
        data?.dateRangeData?.calldriversEnquiry || [];
      const comparisonData: { enquiry_line: string; calls: number }[] =
        data?.comparisonDateRangeData?.calldriversEnquiry || [];

      const callsByEnquiryLine: Record<string, CalldriversTableRow> = {};

      for (const { calls, enquiry_line } of currentData) {
        callsByEnquiryLine[enquiry_line] = {
          enquiry_line,
          currValue: calls,
          prevValue: 0,
        };
      }

      for (const { calls, enquiry_line } of comparisonData) {
        if (!callsByEnquiryLine[enquiry_line]) {
          callsByEnquiryLine[enquiry_line] = {
            enquiry_line,
            currValue: 0,
            prevValue: calls,
          };
        } else {
          callsByEnquiryLine[enquiry_line].prevValue = calls;
        }
      }

      return Object.values(callsByEnquiryLine).map(
        ({ enquiry_line, currValue, prevValue }) => ({
          name: this.i18n.service.translate(`d3-${enquiry_line}`, lang),
          currValue,
          prevValue,
        }),
      );
    }),
  );

  apexCalldriversChart$ = combineLatest([this.calldriversTable$]).pipe(
    map(([data]) => {
      return data.map((d) => ({
        name: d.name,
        data: [d.currValue, d.prevValue],
      }));
    }),
  );

  callsByTopic$ = this.projectsDetailsData$.pipe(
    map((data) => {
      if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
        return null;
      }
      const comparisonData = data?.comparisonDateRangeData?.callsByTopic || [];

      return (data?.dateRangeData?.callsByTopic || []).map((callsByTopic) => {
        const previousCalls = comparisonData.find(
          (prevTopic) => prevTopic.tpc_id === callsByTopic.tpc_id,
        );

        return {
          topic: callsByTopic.topic || '',
          tpc_id: callsByTopic.tpc_id || '',
          enquiry_line: callsByTopic.enquiry_line || '',
          tasks: callsByTopic.tasks || [],
          subtopic: callsByTopic.subtopic || '',
          sub_subtopic: callsByTopic.sub_subtopic || '',
          calls: callsByTopic.calls,
          change: !previousCalls?.calls
            ? null
            : percentChange(callsByTopic.calls, previousCalls.calls),
          difference: callsByTopic.calls - (previousCalls?.calls || 0),
        };
      });
    }),
  );

  callsByTopicConfig$ = createColConfigWithI18n<CallsByTopicTableType>(
    this.i18n.service,
    [
      {
        field: 'tpc_id',
        header: 'tpc_id',
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
        field: 'tasks',
        header: 'Task',
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
    ] as ColumnConfig<UnwrapObservable<typeof this.callsByTopic$>>[],
  );

  dyfDataApex$ = combineLatest([
    this.projectsDetailsData$,
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

  dyfData$ = combineLatest([this.projectsDetailsData$, this.currentLang$]).pipe(
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

  gscTotalClicks$ = this.projectsDetailsData$.pipe(
    map((data) => data?.dateRangeData?.gscTotalClicks || 0),
  );
  gscTotalClicksPercentChange$ = this.projectsDetailsData$.pipe(
    mapToPercentChange('gscTotalClicks'),
  );

  gscTotalImpressions$ = this.projectsDetailsData$.pipe(
    map((data) => data?.dateRangeData?.gscTotalImpressions || 0),
  );
  gscTotalImpressionsPercentChange$ = this.projectsDetailsData$.pipe(
    mapToPercentChange('gscTotalImpressions'),
  );

  gscTotalCtr$ = this.projectsDetailsData$.pipe(
    map((data) => data?.dateRangeData?.gscTotalCtr || 0),
  );
  gscTotalCtrPercentChange$ = this.projectsDetailsData$.pipe(
    mapToPercentChange('gscTotalCtr'),
  );

  gscTotalPosition$ = this.projectsDetailsData$.pipe(
    map((data) => data?.dateRangeData?.gscTotalPosition || 0),
  );
  gscTotalPositionPercentChange$ = this.projectsDetailsData$.pipe(
    mapToPercentChange('gscTotalPosition'),
  );

  taskSuccessByUxTest$ = combineLatest([
    this.projectsDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const uxTests = data?.taskSuccessByUxTest;

      if (!uxTests) {
        return [];
      }

      const dateFormat = lang === FR_CA ? 'D MMM YYYY' : 'MMM DD, YYYY';

      const maxTotalUsers = Math.max(
        ...uxTests.map((test) => test.total_users || 0),
      );

      return uxTests.map((uxTest) => ({
        ...uxTest,
        date: uxTest.date
          ? dayjs.utc(uxTest.date).locale(lang).format(dateFormat)
          : null,
        test_type: uxTest.test_type
          ? this.i18n.service.translate(uxTest.test_type, lang)
          : uxTest.test_type,
        tasks: uxTest.tasks
          .split('; ')
          .map((task) =>
            task ? this.i18n.service.translate(task, lang) : task,
          )
          .join('; '),
        total_users: maxTotalUsers,
      }));
    }),
  );

  apexTaskSuccessByUxTest$ = combineLatest([
    this.projectsDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const uxTests = data?.taskSuccessByUxTest.filter(
        (uxTest) => uxTest.success_rate || uxTest.success_rate === 0,
      );

      const tasksWithSuccessRate = uxTests
        ?.map((uxTest) => uxTest.tasks.split('; ') || [])
        .flat();

      const taskTitles = data?.taskMetrics
        .filter(({ title }) => tasksWithSuccessRate.includes(title))
        .map((task) => task.title);

      const uniqueTestTypes = [
        ...new Set(uxTests.map((item) => item.test_type)),
      ];

      const validTests = uxTests
        .filter((uxTest) => !isNullish(uxTest.success_rate))
        .map((uxTest) => ({ ...uxTest, _tasks: uxTest.tasks.split('; ') }));

      const validTestsByTask = arrayToDictionaryMultiref(
        validTests,
        '_tasks',
        true,
      );

      const taskSuccessRatesByTestType = uniqueTestTypes.map((testType) => ({
        name: this.i18n.service.translate(testType as string, lang),
        // `data` is an array of avg success rate by task
        data: taskTitles.map((taskTitle) => {
          const taskSuccessRates =
            validTestsByTask[taskTitle]
              ?.filter((uxTest) => uxTest.test_type === testType)
              .map((uxTest) => uxTest.success_rate || 0) || [];

          return avg(taskSuccessRates);
        }),
      }));

      return {
        series: taskSuccessRatesByTestType,
        xaxis: taskTitles.map((task) =>
          this.i18n.service.translate(task, lang),
        ),
      };
    }),
  );

  taskSuccessChartHeight$ = this.apexTaskSuccessByUxTest$.pipe(
    map((chart) => chart.xaxis.length * 35 * chart.series.length + 100),
  );

  taskSuccessByUxTestKpi$ = combineLatest([
    this.projectsDetailsData$,
    this.projectTasks$, // combined to access tasks id
    this.currentLang$,
  ]).pipe(
    map(([data, projectTasks, lang]) => {
      const uxTests = data?.taskSuccessByUxTest;

      if (!uxTests) {
        return [];
      }

      const tasks = uxTests
        ?.map((uxTest) => uxTest?.tasks?.split('; '))
        .reduce((acc, val) => acc.concat(val), [])
        .filter((v, i, a) => a.indexOf(v) === i);

      const taskSuccess = tasks?.map((task) => {
        const successRate = uxTests?.map((uxTest) => {
          const taskSuccessRate = uxTest?.tasks
            ?.split('; ')
            .find((t) => t === task);

          return {
            successRate: taskSuccessRate ? uxTest?.success_rate : null,
            date: uxTest?.date,
            testType: uxTest?.test_type,
          };
        });
        return {
          task,
          date: successRate?.map((v) => v.date),
          success_rate: successRate
            ?.map((success) => {
              return {
                ...success,
              };
            })
            .filter(({ successRate }) => successRate !== null),
        };
      });

      const taskSuccessByUxTestKpi = taskSuccess?.map((task) => {
        const taskSuccessByUxTestKpi = task.success_rate
          ?.map((success) => {
            return {
              test_type: success.testType as string,
              success_rate: success.successRate as number,
            };
          })
          .reduce(
            (acc, val) => {
              if (acc[val.test_type]) {
                acc[val.test_type].success_rate += val.success_rate;
                acc[val.test_type].count += 1;
              } else {
                acc[val.test_type] = {
                  test_type: val.test_type,
                  success_rate: val.success_rate,
                  count: 1,
                };
              }
              return acc;
            },
            {} as {
              [testType: string]: {
                test_type: string;
                success_rate: number;
                count: number;
              };
            },
          );

        const taskSuccessByUxTestKpiAvg = Object.keys(
          taskSuccessByUxTestKpi,
        ).map((testType) => {
          const successRate =
            taskSuccessByUxTestKpi[testType].success_rate /
            (taskSuccessByUxTestKpi[testType].count || 1);

          return {
            // test_type: testType,
            // avg_success_rate: successRate,
            [testType]: successRate,
          };
        });

        return {
          _id: projectTasks.find((t) => t.title === task.task)?._id.toString(), // combined from projectTasks
          task: task.task
            ? this.i18n.service.translate(task.task, lang)
            : task.task,
          ...taskSuccessByUxTestKpiAvg.reduce((a, b) => {
            return {
              ...a,
              ...b,
            };
          }, {}),
        } as TaskKpi;
      });

      return taskSuccessByUxTestKpi?.map((task) => {
        const validation = task.Validation;
        const baseline = task.Baseline;
        const change = (round(validation, 2) - round(baseline, 2)) * 100;
        const taskPercentChange = percentChange(
          round(validation, 2),
          round(baseline, 2),
        );

        return {
          ...task,
          change,
          taskPercentChange,
        };
      });
    }),
  );

  totalParticipants$ = this.projectsDetailsData$.pipe(
    map((data) => {
      const uxTests = data?.taskSuccessByUxTest;

      const maxUsersByType: Record<string, number> = {};

      for (const { test_type, total_users = 0 } of uxTests) {
        if (test_type) {
          maxUsersByType[test_type] = Math.max(
            maxUsersByType[test_type] || 0,
            total_users,
          );
        }
      }

      const totalUsers = Object.values(maxUsersByType).reduce(
        (accumulator, value) => accumulator + value,
        0,
      );
      return totalUsers;
    }),
  );

  feedbackTotalComments$ = this.projectsDetailsData$.pipe(
    map((data) => data?.numComments),
  );

  commentsPercentChange$ = this.projectsDetailsData$.pipe(
    map((data) => data?.numCommentsPercentChange),
  );

  dateRangeLabel$ = combineLatest([
    this.projectsDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) => this.getDateRangeLabel(data.dateRange, lang) as string,
    ),
  );

  comparisonDateRangeLabel$ = combineLatest([
    this.projectsDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(data.comparisonDateRange || '', lang) as string,
    ),
  );

  fullDateRangeLabel$ = combineLatest([
    this.projectsDetailsData$,
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
    this.projectsDetailsData$,
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

  lineTaskChart$ = combineLatest([
    this.projectsDetailsData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const taskSuccessByUxData = data?.taskSuccessByUxTest;
      const tasksWithSuccessRate = taskSuccessByUxData?.filter(
        (test) => test.success_rate || test.success_rate === 0,
      );

      if (!taskSuccessByUxData || !tasksWithSuccessRate.length) {
        return [];
      }

      const tasks = taskSuccessByUxData
        ?.map((uxTest) => uxTest?.tasks?.split('; '))
        .reduce((acc, val) => acc.concat(val), [])
        .filter((v, i, a) => a.indexOf(v) === i);

      return tasks
        ?.map((task) => {
          const successRate = taskSuccessByUxData
            ?.map((uxTest) => {
              const taskSuccessRate = uxTest?.tasks
                ?.split('; ')
                .find((t) => t === task);

              return {
                value: taskSuccessRate ? uxTest?.success_rate : null,
                name: uxTest?.test_type
                  ? this.i18n.service.translate(uxTest.test_type, lang)
                  : '',
                extra: {
                  date: uxTest?.date,
                },
              };
            })
            .filter((v) => v.value !== null && v.value !== undefined)
            .sort((a, b) => {
              if (a.name > b.name) return 1;
              if (a.name < b.name) return -1;
              return 0;
            });
          return {
            task,
            date: successRate?.map((v) => v.extra.date),
            success_rate: successRate
              ?.map((success) => {
                return {
                  ...success,
                };
              })
              .filter(({ value }) => value !== null),
          };
        })
        .map((task) => ({
          name: task.task
            ? this.i18n.service.translate(task.task, lang)
            : task.task,
          series: task.success_rate,
        }))
        .filter((v) => v.name !== null && v.name !== '')
        .sort((a, b) => {
          return a.series.length < b.series.length ? 1 : -1;
        });
    }),
  );

  documents$ = this.projectsDetailsData$.pipe(
    map((data) =>
      data?.attachments.map((attachment) => ({
        url: attachment.storage_url,
        filename: attachment.filename,
      })),
    ),
  );

  topSearchTerms$ = this.projectsDetailsData$.pipe(
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

  startDate$ = this.projectsDetailsData$.pipe(
    map(({ startDate }) => startDate),
  );
  launchDate$ = this.projectsDetailsData$.pipe(
    map(({ launchDate }) => launchDate),
  );

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

  feedbackMostRelevant = this.store.selectSignal(
    ProjectsDetailsSelectors.selectFeedbackMostRelevant,
  );

  error$ = this.store.select(
    ProjectsDetailsSelectors.selectProjectsDetailsError,
  );

  init() {
    this.store.dispatch(ProjectsDetailsActions.loadProjectsDetailsInit());
  }
}

type DateRangeDataIndexKey = keyof ProjectDetailsAggregatedData &
  keyof PickByType<ProjectDetailsAggregatedData, number>;

// helper function to get the percent change of a property vs. the comparison date range
function mapToPercentChange(
  propName: keyof PickByType<ProjectDetailsAggregatedData, number>,
) {
  return map((data: ProjectsDetailsData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return 0;
    }

    const current = data?.dateRangeData[propName as DateRangeDataIndexKey];
    const previous =
      data?.comparisonDateRangeData[propName as DateRangeDataIndexKey];

    if (!current || !previous) {
      return 0;
    }

    return percentChange(current, previous);
  });
}

function mapPageMetricsArraysWithPercentChange(
  propName: keyof ProjectDetailsAggregatedData,
  propPath: string,
) {
  return map((data: ProjectsDetailsData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return;
    }

    const current = [...((data?.dateRangeData?.[propName] || []) as any[])];
    const previous = [
      ...((data?.comparisonDateRangeData?.[propName] || []) as any[]),
    ];

    const currentMetricsByPage = current.reduce(
      (metricsByPage, page: VisitsByPage) => {
        metricsByPage[page._id] = {
          ...page,
        };

        return metricsByPage;
      },
      {} as { [pageId: string]: Record<string, number> },
    );

    const previousMetricsByPage = previous.reduce(
      (metricsByPage, page: VisitsByPage) => {
        metricsByPage[page._id] = {
          ...page,
        };

        return metricsByPage;
      },
      {} as { [pageId: string]: Record<string, number> },
    );

    return Object.keys(currentMetricsByPage).map((pageId: string) => {
      const currentMetrics = currentMetricsByPage[pageId];
      const previousMetrics = previousMetricsByPage[pageId];

      return {
        ...currentMetrics,
        percentChange: previousMetrics
          ? percentChange(currentMetrics[propPath], previousMetrics[propPath])
          : null,
      };
    });
  });
}
