import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import 'dayjs/locale/en-ca';
import 'dayjs/locale/fr-ca';
import { combineLatest, debounceTime, map, mergeMap, of } from 'rxjs';
import { FR_CA, type LocaleId } from '@dua-upd/upd/i18n';
import type {
  ColumnConfig,
  OverviewAggregatedData,
  OverviewData,
} from '@dua-upd/types-common';
import {
  avg,
  percentChange,
  round,
  type UnwrapObservable,
} from '@dua-upd/utils-common';
import type { PickByType } from '@dua-upd/utils-common';
import * as OverviewActions from './overview.actions';
import * as OverviewSelectors from './overview.selectors';
import {
  I18nFacade,
  selectDatePeriodSelection,
  selectUrl,
} from '@dua-upd/upd/state';
import { createColConfigWithI18n } from '@dua-upd/upd/utils';
import type { ApexAxisChartSeries } from 'ng-apexcharts';
import {
  selectCallsPerVisitsChartData,
  selectComboChartData,
  selectComboChartTable,
  selectDyfNoPerVisitsSeries,
  selectVisitsByDayChartData,
  selectVisitsByDayChartTable,
} from './overview.selectors';

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);
dayjs.extend(quarterOfYear);

@Injectable()
export class OverviewFacade {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nFacade);

  currentLang$ = this.i18n.currentLang$;
  loaded$ = this.store.select(OverviewSelectors.selectOverviewLoaded);
  loading$ = this.store
    .select(OverviewSelectors.selectOverviewLoading)
    .pipe(debounceTime(100));
  dateRangeSelected$ = this.store.select(selectDatePeriodSelection);
  overviewData$ = this.store.select(OverviewSelectors.selectOverviewData);

  annotationsData$ = this.store.select(
    OverviewSelectors.selectAnnotationsSeries,
  );

  currentRoute$ = this.store
    .select(selectUrl)
    .pipe(map((url) => url.replace(/\?.+$/, '')));

  visitors$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.visitors || 0),
  );
  visitorsPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('visitors'),
  );

  visits$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.visits || 0),
  );
  comparisonVisits$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.comparisonDateRangeData?.visits || 0),
  );
  visitsPercentChange$ = this.overviewData$.pipe(mapToPercentChange('visits'));

  views$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.pageViews || 0),
  );

  viewsPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('pageViews'),
  );

  impressions$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.impressions || 0),
  );
  impressionsPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('impressions'),
  );

  ctr$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.ctr || 0),
  );
  ctrPercentChange$ = this.overviewData$.pipe(mapToPercentChange('ctr'));

  avgRank$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.position || 0),
  );
  avgRankPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('position'),
  );

  topPagesVisited$ = this.overviewData$.pipe(
    map((data) => data?.dateRangeData?.topPagesVisited || []),
  );

  topPagesVisitedWithPercentChange$ = this.overviewData$.pipe(
    mapObjectArraysWithPercentChange('topPagesVisited', 'visits', 'url'),
    map((topPages) => topPages?.sort((a, b) => b.visits - a.visits)),
  );

  top10GSC$ = this.overviewData$.pipe(
    mapObjectArraysWithPercentChange('top10GSC', 'clicks'),
  );

  projects$ = this.overviewData$.pipe(
    map((data) => data?.projects?.projects || []),
  );

  kpiLastAvgSuccessRate$ = this.overviewData$.pipe(
    map((data) => data?.projects?.avgTestSuccessAvg || 0),
  );

  kpiTotAvgSuccessRate$ = this.overviewData$.pipe(
    map((data) => data?.projects?.avgTestSuccess || 0),
  );

  improvedKpi$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.improvedTasksKpi),
  );

   wosImprovedKpi$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.wosImprovedTasksKpi),
  );

  improvedKpiUniqueTasks$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.uniqueTasks || 0),
  );

  wosImprovedKpiUniqueTasks$ = this.wosImprovedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.uniqueTasks || 0),
  );

  improvedKpiSuccessRate$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates || 0),
  );

  improvedKpiSuccessRateDifference$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates.difference || 0),
  );

  improvedKpiSuccessRateDifferencePoints$ = this.improvedKpi$.pipe(
    map((improvedKpi) => round(improvedKpi?.successRates.difference as number * 100, 0) || 0),
  );

  improvedKpiSuccessRateValidation$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates.validation || 0),
  );
  
  improvedKpiSuccessRateBaseline$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates.baseline || 0),
  );

   wosImprovedKpiSuccessRateDifferencePoints$ = this.wosImprovedKpi$.pipe(
    map((improvedKpi) => round(improvedKpi?.successRates.difference as number * 100, 0) || 0),
  );

  wosImprovedKpiSuccessRateValidation$ = this.wosImprovedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates.validation || 0),
  );

  wosImprovedKpiSuccessRateBaseline$ = this.wosImprovedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates.baseline || 0),
  );

  improvedTopKpi$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.improvedKpiTopSuccessRate),
  );

  improvedKpiTopUniqueTasks$ = this.improvedTopKpi$.pipe(
    map((improvedTopKpi) => improvedTopKpi?.uniqueTopTasks || 0),
  );

  improvedKpiTopTasks$ = this.improvedTopKpi$.pipe(
    map((improvedTopKpi) => improvedTopKpi?.allTopTasks || 0),
  );

  improvedKpiTopSuccessRate$ = this.improvedTopKpi$.pipe(
    map((improvedTopKpi) => improvedTopKpi?.topSuccessRates || 0),
  );

  improvedKpiTopSuccessRateDifference$ = this.improvedTopKpi$.pipe(
    map((improvedTopKpi) => improvedTopKpi?.topSuccessRates.difference || 0),
  );

  improvedKpiTopSuccessRateDifferencePoints$ = this.improvedTopKpi$.pipe(
    map((improvedTopKpi) => round(improvedTopKpi?.topSuccessRates.difference as number * 100, 0) || 0),
  );

  improvedKpiTopSuccessRateValidation$ = this.improvedTopKpi$.pipe(
    map((improvedTopKpi) => improvedTopKpi?.topSuccessRates.validation || 0),
  );

  improvedKpiTopSuccessRateBaseline$ = this.improvedTopKpi$.pipe(
    map((improvedTopKpi) => improvedTopKpi?.topSuccessRates.baseline || 0),
  );

  kpiTestsCompleted$ = this.overviewData$.pipe(
    map((data) => data?.projects?.testsCompleted || 0),
  );

  uniqueTaskTestedLatestTestKpi$ = this.overviewData$.pipe(
    map((data) => data?.projects?.uniqueTaskTestedLatestTestKpi || 0),
  );

  totalTasks$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.totalTasks || 0),
  );

  testTypeTranslations$ = combineLatest([
    this.projects$,
    this.currentLang$,
  ]).pipe(
    mergeMap(([projects]) => {
      const splitTestTypes = projects.flatMap(
        (project) => project.testType || [],
      );

      const testTypes = [...new Set<string>(splitTestTypes)];

      return testTypes.length > 0 ? this.i18n.service.get(testTypes) : of({});
    }),
  );

  projectsList$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
    this.testTypeTranslations$,
  ]).pipe(
    map(([data, lang, testTypeTranslations]) => {
      const uxTests = data?.uxTests || [];

      const maxUsersByTitleAndType: Record<string, Record<string, number>> = {};

      for (const { title, test_type, total_users = 0 } of uxTests) {
        if (title && test_type) {
          maxUsersByTitleAndType[title] = maxUsersByTitleAndType[title] || {};
          maxUsersByTitleAndType[title][test_type] = Math.max(
            maxUsersByTitleAndType[title][test_type] || 0,
            total_users,
          );
        }
      }

      const maxUsersByTitle = Object.keys(maxUsersByTitleAndType).reduce(
        (accumulator, title) => {
          const typeValues = maxUsersByTitleAndType[title];
          accumulator[title] = Object.values(typeValues).reduce(
            (typeSum, value) => typeSum + value,
            0,
          );
          return accumulator;
        },
        {} as Record<string, number>,
      );

      return (
        data?.projects?.projects.map((proj) => ({
          ...proj,
          title: proj.title
            ? this.i18n.service.translate(proj.title.trim(), lang)
            : '',
          testType: (proj.testType || [])
            .map(
              (testType: string) =>
                (testTypeTranslations as Record<string, string>)[testType] ||
                testType,
            )
            .sort(),
          startDate: proj.startDate || '',
          totalUsers: maxUsersByTitle[proj.title] || 0,
        })) || []
      );
    }),
  );

  calldriversTable$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dateRange = data?.dateRangeData?.calldriversEnquiry || [];
      const comparisonDateRange =
        data?.comparisonDateRangeData?.calldriversEnquiry || [];

      const dataEnquiryLine = dateRange.map((d) => ({
        name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
        currValue: d.sum,
        prevValue:
          comparisonDateRange.find((cd) => d.enquiry_line === cd.enquiry_line)
            ?.sum || null,
      }));

      comparisonDateRange.map((d) => {
        const currVal =
          dateRange.find((cd) => d.enquiry_line === cd.enquiry_line) || 0;

        if (currVal === 0) {
          dataEnquiryLine.push({
            name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
            currValue: 0,
            prevValue: d.sum,
          });
        }
      });

      return dataEnquiryLine.filter(
        (v) => v.currValue > 0 || (v.prevValue || 0) > 0,
      );
    }),
  );

  currentKpiFeedback$ = this.overviewData$.pipe(
    map((data) => {
      const dyfNoCurrent = data?.dateRangeData?.dyf_no || 0;
      const visits = data?.dateRangeData?.visits || 0;

      return dyfNoCurrent / visits;
    }),
  );

  apexKpiFeedback$ = this.store.select(selectDyfNoPerVisitsSeries);

  comparisonKpiFeedback$ = combineLatest([this.overviewData$]).pipe(
    map(([data]) => {
      const dyfNoComparison = data?.comparisonDateRangeData?.dyf_no || 0;
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

  kpiUXTests$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.uxTests
          ?.filter((uxTest) => typeof uxTest.success_rate === 'number')
          .map(({ success_rate }) => success_rate as number) || [],
    ),
  );

  kpiUXTestsPercent$ = combineLatest([this.kpiUXTests$]).pipe(
    map(([data]) => {
      const kpiUxTestsLength = data.length;
      const kpiUxTestsSum = data.reduce((a, b) => a + b, 0);

      return kpiUxTestsSum / kpiUxTestsLength;
    }),
  );

  kpiUXTestsTotal$ = combineLatest([this.kpiUXTests$]).pipe(
    map(([data]) => {
      return data.length;
    }),
  );

  apexCallDriversChart$ = this.calldriversTable$.pipe(
    map(
      (data) =>
        data.map((d) => ({
          name: d.name,
          data: [d.currValue, d.prevValue],
        })) as ApexAxisChartSeries,
    ),
  );

  apexBar$ = this.store.select(selectVisitsByDayChartData);

  comboChartData$ = this.store.select(selectComboChartData);
  apexCallDrivers$ = this.store.select(selectCallsPerVisitsChartData);

  currentCallVolume$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.dateRangeData?.calldriversEnquiry.reduce(
          (totalCalls, enquiryLineCalls) => totalCalls + enquiryLineCalls.sum,
          0,
        ) || 0,
    ),
  );

  comparisonCallVolume$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.comparisonDateRangeData?.calldriversEnquiry.reduce(
          (totalCalls, enquiryLineCalls) => totalCalls + enquiryLineCalls.sum,
          0,
        ) || 0,
    ),
  );

  callPerVisits$ = combineLatest([this.currentCallVolume$, this.visits$]).pipe(
    map(([currentCalls, visits]) => {
      return currentCalls / visits;
    }),
  );

  callComparisonPerVisits$ = combineLatest([
    this.comparisonCallVolume$,
    this.comparisonVisits$,
  ]).pipe(
    map(([comparisonCalls, comparisonVisits]) => {
      return comparisonCalls / comparisonVisits;
    }),
  );

  callPercentChange$ = combineLatest([
    this.currentCallVolume$,
    this.comparisonCallVolume$,
  ]).pipe(
    map(([currentCalls, comparisonVisits]) =>
      percentChange(currentCalls, comparisonVisits),
    ),
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

  barTable$ = this.store.select(selectVisitsByDayChartTable);

  tableMerge$ = this.store.select(selectComboChartTable);

  dateRangeLabel$ = combineLatest([this.overviewData$, this.currentLang$]).pipe(
    map(
      ([data, lang]) => this.getDateRangeLabel(data.dateRange, lang) as string,
    ),
  );

  fullDateRangeLabel$ = combineLatest([
    this.overviewData$,
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

  comparisonDateRangeLabel$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(data.comparisonDateRange || '', lang) as string,
    ),
  );

  fullComparisonDateRangeLabel$ = combineLatest([
    this.overviewData$,
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

  satDateRangeLabel$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(
      ([data, lang]) =>
        this.getDateRangeLabel(data.satDateRange || '', lang) as string,
    ),
  );

  dyfData$ = combineLatest([this.overviewData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      const yes = this.i18n.service.translate('yes', lang);
      const no = this.i18n.service.translate('no', lang);

      const currYesVal = data?.dateRangeData?.dyf_yes || 0;
      const prevYesVal = data?.comparisonDateRangeData?.dyf_yes || NaN;
      const currNoVal = data?.dateRangeData?.dyf_no || 0;
      const prevNoVal = data?.comparisonDateRangeData?.dyf_no || NaN;

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

  dyfDataApex$ = combineLatest([this.overviewData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      const dyfData: ApexAxisChartSeries = [
        {
          name: this.i18n.service.translate('yes', lang),
          data: [
            data?.dateRangeData?.dyf_yes || 0,
            data?.comparisonDateRangeData?.dyf_yes || 0,
          ],
        },
        {
          name: this.i18n.service.translate('no', lang),
          data: [
            data?.dateRangeData?.dyf_no || 0,
            data?.comparisonDateRangeData?.dyf_no || 0,
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

  topTasksTable = toSignal(
    this.overviewData$.pipe(map((data) => data?.topTasksTable || [])),
    { initialValue: [] },
  );

  searchAssessmentData$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const searchAssessment = data?.dateRangeData?.searchAssessmentData
        .map((d) => {
          const isEnglish = d.lang === 'en';
          const rank = isFinite(d.position) ? Math.round(d.position) : NaN;
          const pass = rank <= 3 && rank > 0 ? 'Pass' : 'Fail';
          const url = d.expected_result?.replace(/^https:\/\//i, '');
          return {
            lang: isEnglish
              ? this.i18n.service.translate('English', lang)
              : this.i18n.service.translate('French', lang),
            query: d.query,
            url: url,
            position: rank === 0 ? '-' : rank,
            pass: pass,
            total_searches: d.total_searches,
            total_clicks: d.total_clicks,
            target_clicks: d.target_clicks,
          };
        })
        .sort(
          (a, b) =>
            a.lang.localeCompare(b.lang) || b.total_searches - a.total_searches,
        );

      return [...(searchAssessment || [])];
    }),
  );

  searchAssessmentPassed$ = combineLatest([
    this.searchAssessmentData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      return {
        passed: data.filter((d) => d.pass === 'Pass').length,
        total: data.length,
      };
    }),
  );

  comparisonSearchAssessmentData$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      return data?.comparisonDateRangeData?.searchAssessmentData
        .map((d) => {
          const isEnglish = d.lang === 'en';
          const rank = isFinite(d.position) ? Math.round(d.position) : NaN;
          const pass = rank <= 3 && rank > 0 ? 'Pass' : 'Fail';
          const url = d.expected_result?.replace(/^https:\/\//i, '');
          return {
            lang: isEnglish
              ? this.i18n.service.translate('English', lang)
              : this.i18n.service.translate('French', lang),
            query: d.query,
            url: url,
            position: rank,
            pass: pass,
            total_searches: d.total_searches,
            total_clicks: d.total_clicks,
            target_clicks: d.target_clicks,
          };
        })
        .sort(
          (a, b) =>
            a.lang.localeCompare(b.lang) || b.total_searches - a.total_searches,
        );
    }),
  );

  currentKpiSearchAssessment$ = combineLatest([
    this.searchAssessmentData$,
  ]).pipe(
    map(([searchAssessmentData]) => {
      const kpiSearchAssessment = searchAssessmentData || [];
      return (
        kpiSearchAssessment.filter((d) => d.pass === 'Pass').length /
        kpiSearchAssessment.length
      );
    }),
  );

  comparisonKpiSearchAssessment$ = combineLatest([
    this.comparisonSearchAssessmentData$,
  ]).pipe(
    map(([comparisonSearchAssessmentData]) => {
      const kpiSearchAssessment = comparisonSearchAssessmentData || [];
      return (
        kpiSearchAssessment.filter((d) => d.pass === 'Pass').length /
        kpiSearchAssessment.length
      );
    }),
  );

  kpiSearchAssessmentPercentChange$ = combineLatest([
    this.currentKpiSearchAssessment$,
    this.comparisonKpiSearchAssessment$,
  ]).pipe(
    map(([currentKpiSearchAssessment, comparisonKpiSearchAssessment]) => {
      return percentChange(
        currentKpiSearchAssessment,
        comparisonKpiSearchAssessment,
      );
    }),
  );

  uxTestsCompleted$ = this.overviewData$.pipe(
    map((data) => data.testsCompletedSince2018),
  );
  uxTasksTested$ = this.overviewData$.pipe(
    map((data) => data.tasksTestedSince2018),
  );
  uxParticipantsTested$ = this.projectsList$.pipe(
    map((data) => data.reduce((a, b) => a + b.totalUsers, 0)),
  );
  uxTestsConductedLastFiscal$ = this.overviewData$.pipe(
    map((data) => data.testsConductedLastFiscal),
  );
  uxTestsConductedLastQuarter$ = this.overviewData$.pipe(
    map((data) => data.testsConductedLastQuarter),
  );
  uxCopsTestsCompleted$ = this.overviewData$.pipe(
    map((data) => data.copsTestsCompletedSince2018),
  );

  calldriverTopics$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) =>
      data.calldriverTopics.map((topicData) => ({
        topic: topicData.topic || '',
        tpc_id: topicData.tpc_id || '',
        enquiry_line:
          this.i18n.service.translate(`d3-${topicData.enquiry_line}`, lang) ||
          '',
        subtopic: topicData.subtopic || '',
        sub_subtopic: topicData.sub_subtopic || '',
        tasks: topicData.tasks,
        calls: topicData.calls,
        change: topicData.change,
        difference: topicData.difference,
      })),
    ),
  );

  gcTasksTable$ = this.overviewData$.pipe(
    map((data) =>
      data?.dateRangeData?.gcTasksData.map((d) => {
        const data_reliability = evaluateDataReliability(d.margin_of_error);
        const baseData = { ...d, data_reliability };

        return data_reliability === 'Insufficient data'
          ? {
              ...baseData,
              able_to_complete: NaN,
              ease: NaN,
              satisfaction: NaN,
              margin_of_error: NaN,
            }
          : baseData;
      }),
    ),
  );

  comparisonGcTasksTable$ = this.overviewData$.pipe(
    map((data) =>
      data?.comparisonDateRangeData?.gcTasksData.map((d) => {
        const data_reliability = evaluateDataReliability(d.margin_of_error);
        const baseData = { ...d, data_reliability };

        return data_reliability === 'Insufficient data'
          ? {
              ...baseData,
              able_to_complete: NaN,
              ease: NaN,
              satisfaction: NaN,
              margin_of_error: NaN,
            }
          : baseData;
      }),
    ),
  );

  gcTasksCompletionAvg$ = this.gcTasksTable$.pipe(
    map((data) =>
      data?.length
        ? avg(
            data
              .map((d) => d.able_to_complete)
              .filter((value) => value === 0 || value),
          )
        : null,
    ),
  );

  comparisonGcTasksCompletionsAvg$ = this.comparisonGcTasksTable$.pipe(
    map((data) =>
      data?.length
        ? avg(
            data
              .map((d) => d.able_to_complete)
              .filter((value) => value === 0 || value),
          )
        : null,
    ),
  );

  gcTasksCompletionPercentChange$ = combineLatest([
    this.gcTasksCompletionAvg$,
    this.comparisonGcTasksCompletionsAvg$,
  ]).pipe(
    map(([gcTasksCompletionsAvg, comparisonGcTasksCompletionsAvg]) =>
      gcTasksCompletionsAvg !== null && comparisonGcTasksCompletionsAvg !== null
        ? percentChange(gcTasksCompletionsAvg, comparisonGcTasksCompletionsAvg)
        : null,
    ),
  );

  gcTasksEaseAvg$ = this.gcTasksTable$.pipe(
    map((data) =>
      data?.length
        ? avg(data.map((d) => d.ease).filter((value) => value === 0 || value))
        : null,
    ),
  );

  comparisonGcTasksEaseAvg$ = this.comparisonGcTasksTable$.pipe(
    map((data) =>
      data?.length
        ? avg(data.map((d) => d.ease).filter((value) => value === 0 || value))
        : null,
    ),
  );

  gcTasksEasePercentChange$ = combineLatest([
    this.gcTasksEaseAvg$,
    this.comparisonGcTasksEaseAvg$,
  ]).pipe(
    map(([gcTasksEaseAvg, comparisonGcTasksEaseAvg]) =>
      gcTasksEaseAvg !== null && comparisonGcTasksEaseAvg !== null
        ? percentChange(gcTasksEaseAvg, comparisonGcTasksEaseAvg)
        : null,
    ),
  );

  gcTasksSatisfactionAvg$ = this.gcTasksTable$.pipe(
    map((data) =>
      data?.length
        ? avg(
            data
              .map((d) => d.satisfaction)
              .filter((value) => value === 0 || value),
          )
        : null,
    ),
  );

  comparisonGcTasksSatisfactionAvg$ = this.comparisonGcTasksTable$.pipe(
    map((data) =>
      data?.length
        ? avg(
            data
              .map((d) => d.satisfaction)
              .filter((value) => value === 0 || value),
          )
        : null,
    ),
  );

  gcTasksSatisfactionPercentChange$ = combineLatest([
    this.gcTasksSatisfactionAvg$,
    this.comparisonGcTasksSatisfactionAvg$,
  ]).pipe(
    map(([gcTasksSatisfactionAvg, comparisonGcTasksSatisfactionAvg]) =>
      gcTasksSatisfactionAvg !== null &&
      comparisonGcTasksSatisfactionAvg !== null
        ? percentChange(
            gcTasksSatisfactionAvg,
            comparisonGcTasksSatisfactionAvg,
          )
        : null,
    ),
  );

  gcTasksTableConfig$ = createColConfigWithI18n(this.i18n.service, [
    { field: 'gc_task', header: 'gc_task', translate: true },
    { field: 'theme', header: 'theme', translate: true },
    { field: 'total_entries', header: 'total-entries', pipe: 'number' },
    {
      field: 'able_to_complete',
      header: 'able-to-complete',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    {
      field: 'ease',
      header: 'ease',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    {
      field: 'satisfaction',
      header: 'satisfaction',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    {
      field: 'margin_of_error',
      header: 'margin-of-error',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    { field: 'data_reliability', header: 'data-reliability', translate: true },
  ]);

  gcTasksCommentsTable$ = this.overviewData$.pipe(
    map((data) => data?.dateRangeData?.gcTasksComments || []),
  );

  gcTasksCommentsTableConfig$ = createColConfigWithI18n(this.i18n.service, [
    { field: 'date', header: 'Date', pipe: 'date' },
    { field: 'gc_task', header: 'gc_task', translate: true },
    {
      field: 'gc_task_other',
      header: 'Other GC Task',
      translate: true,
      hide: true,
    },
    { field: 'url', header: 'Survey Referrer', translate: true, hide: true },
    { field: 'language', header: 'Language', translate: true, hide: true },
    { field: 'device', header: 'Device', translate: true, hide: true },
    { field: 'screener', header: 'Screener', translate: true, hide: true },
    { field: 'theme', header: 'Theme', translate: true, hide: true },
    {
      field: 'grouping',
      header: 'Grouping',
      translate: true,
      hide: true,
      tooltip: 'tooltip-grouping',
    },
    { field: 'able_to_complete', header: 'Able to Complete', translate: true },
    { field: 'ease', header: 'ease', translate: true },
    { field: 'satisfaction', header: 'satisfaction', translate: true },
    {
      field: 'what_would_improve',
      header: 'What Would Improve',
      translate: true,
      hide: true,
    },
    {
      field: 'what_would_improve_comment',
      header: 'Improvement Comment',
      translate: true,
      tooltip: 'tooltip-improvement-comment',
    },
    {
      field: 'reason_not_complete',
      header: 'Reason Not Complete',
      translate: true,
      hide: true,
    },
    {
      field: 'reason_not_complete_comment',
      header: 'Reason Not Complete Comment',
      translate: true,
      tooltip: 'tooltip-notcomplete-comment',
    },
  ]);

  top5IncreasedCalldriverTopics$ = this.overviewData$.pipe(
    map((data) =>
      data.top5IncreasedCalldriverTopics.map((topicData) => ({
        topic: topicData.topic || '',
        tpc_id: topicData.tpc_id || '',
        enquiry_line: topicData.enquiry_line || '',
        subtopic: topicData.subtopic || '',
        sub_subtopic: topicData.sub_subtopic || '',
        calls: topicData.calls,
        change: topicData.change,
        difference: topicData.difference,
      })),
    ),
  );

  top5IncreasedCalldriverTopicsConfig$ = createColConfigWithI18n(
    this.i18n.service,
    [
      { field: 'tpc_id', header: 'tpc_id', translate: true },
      { field: 'enquiry_line', header: 'enquiry_line', translate: true },
      { field: 'topic', header: 'topic', translate: true },
      { field: 'subtopic', header: 'sub-topic', translate: true },
      { field: 'sub_subtopic', header: 'sub-subtopic', translate: true },
      { field: 'calls', header: 'calls', pipe: 'number' },
      {
        field: 'change',
        header: 'change',
        pipe: 'percent',
        pipeParam: '1.0-2',
        upGoodDownBad: true,
        indicator: true,
        useArrows: true,
        showTextColours: true,
        secondaryField: {
          field: 'difference',
          pipe: 'number',
        },
        width: '160px',
      },
    ] as ColumnConfig<
      UnwrapObservable<typeof this.top5IncreasedCalldriverTopics$>
    >[],
  );

  top5DecreasedCalldriverTopics$ = this.overviewData$.pipe(
    map((data) =>
      data.top5DecreasedCalldriverTopics.map((topicData) => ({
        topic: topicData.topic || '',
        tpc_id: topicData.tpc_id || '',
        enquiry_line: topicData.enquiry_line || '',
        subtopic: topicData.subtopic || '',
        sub_subtopic: topicData.sub_subtopic || '',
        calls: topicData.calls,
        change: topicData.change,
        difference: topicData.difference,
      })),
    ),
  );

  top5DecreasedCalldriverTopicsConfig$ = createColConfigWithI18n(
    this.i18n.service,
    [
      { field: 'tpc_id', header: 'tpc_id', translate: true },
      { field: 'enquiry_line', header: 'enquiry_line', translate: true },
      { field: 'topic', header: 'topic', translate: true },
      { field: 'subtopic', header: 'sub-topic', translate: true },
      { field: 'sub_subtopic', header: 'sub-subtopic', translate: true },
      { field: 'calls', header: 'calls', pipe: 'number' },
      {
        field: 'change',
        header: 'change',
        pipe: 'percent',
        pipeParam: '1.0-2',
        upGoodDownBad: true,
        indicator: true,
        useArrows: true,
        showTextColours: true,
        secondaryField: {
          field: 'difference',
          pipe: 'number',
        },
        width: '160px',
      },
    ] as ColumnConfig<
      UnwrapObservable<typeof this.top5DecreasedCalldriverTopics$>
    >[],
  );

  top20SearchTermsEn$ = this.overviewData$.pipe(
    map((data) => data?.searchTermsEn),
  );
  top20SearchTermsFr$ = this.overviewData$.pipe(
    map((data) => data?.searchTermsFr),
  );

  searchTermsColConfig$ = createColConfigWithI18n<
    UnwrapObservable<typeof this.top20SearchTermsEn$>
  >(this.i18n.service, [
    { field: 'term', header: 'search-term' },
    { field: 'total_searches', header: 'Total searches', pipe: 'number' },
    {
      field: 'searchesChange',
      header: 'change-for-searches',
      pipe: 'percent',
    },
    { field: 'clicks', header: 'clicks', pipe: 'number' },
    { field: 'ctr', header: 'ctr', pipe: 'percent' },
    {
      field: 'position',
      header: 'position',
      pipe: 'number',
      pipeParam: '1.0-2',
    },
  ]);

  error$ = this.store.select(OverviewSelectors.selectOverviewError);

  init() {
    this.store.dispatch(OverviewActions.init());
  }

  getMostRelevantFeedback() {
    this.store.dispatch(OverviewActions.getMostRelevantFeedback());
  }

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
}

type DateRangeDataIndexKey = keyof OverviewAggregatedData &
  keyof PickByType<OverviewAggregatedData, number>;

// helper function to get the percent change of a property vs. the comparison date range
function mapToPercentChange(
  propName: keyof PickByType<OverviewAggregatedData, number>,
) {
  return map((data: OverviewData) => {
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

function mapObjectArraysWithPercentChange(
  propName: keyof OverviewAggregatedData,
  propPath: string,
  sortPath?: string,
) {
  return map((data: OverviewData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return;
    }

    const current = [...((data?.dateRangeData?.[propName] || []) as any[])];
    const previous = [
      ...((data?.comparisonDateRangeData?.[propName] || []) as any[]),
    ];

    if (!current || !previous) {
      return;
    }

    const propsAreValidArrays =
      Array.isArray(current) &&
      Array.isArray(previous) &&
      current.length > 0 &&
      previous.length > 0 &&
      current.length === previous.length;

    if (propsAreValidArrays) {
      const sortBy = (a: any, b: any) => {
        if (sortPath && a[sortPath] instanceof Date) {
          return a[sortPath].getTime() - b[sortPath].getTime();
        }

        if (sortPath && typeof a[sortPath] === 'string') {
          return a[sortPath].localeCompare(b[sortPath]);
        }

        return 0;
      };

      current.sort(sortBy);
      previous.sort(sortBy);

      return current.map((val: any, i) => ({
        ...val,
        percentChange: percentChange(
          val[propPath],
          (previous as any)[i][propPath],
        ),
      }));
    }

    throw Error('Invalid data arrays in mapObjectArraysWithPercentChange');
  });
}

function evaluateDataReliability(errorMargin: number) {
  if (errorMargin > 0 && errorMargin < 0.05)
    return 'Low margin of error/Reliable data';
  if (errorMargin >= 0.05 && errorMargin < 0.1)
    return 'Higher margin of error/Use data with caution';
  return 'Insufficient data';
}
