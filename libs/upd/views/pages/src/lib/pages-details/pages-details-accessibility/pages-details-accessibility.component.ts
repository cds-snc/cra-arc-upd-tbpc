import {
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { PagesDetailsFacade } from '../+state/pages-details.facade';
import { toSignal } from '@angular/core/rxjs-interop';
import { globalColours } from '@dua-upd/utils-common';
import type {
  ColumnConfig,
  AccessibilityAudit,
  AccessibilityImpact,
  AccessibilityViewport,
} from '@dua-upd/types-common';
import {
  AUTOMATED_CRITERIA_COUNT,
  MANUAL_CRITERIA,
  WCAG_AA_CRITERIA_COUNT,
} from './manual-criteria';

const VIEWPORTS: readonly AccessibilityViewport[] = ['desktop', 'mobile'];

type CategorizedAudits = {
  failed: AccessibilityAudit[];
  manual: AccessibilityAudit[];
  passed: AccessibilityAudit[];
  notApplicable: AccessibilityAudit[];
  advisory: AccessibilityAudit[];
  reference: AccessibilityAudit[];
  experimental: AccessibilityAudit[];
};

type AuditTableRow = { category: string; count: number };

/** `globalColours` carries no red, so the failure series needs its own colour. */
const FAILED_SERIES_COLOUR = '#df2929';

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

@Component({
  selector: 'upd-pages-details-accessibility',
  templateUrl: './pages-details-accessibility.component.html',
  styleUrls: ['./pages-details-accessibility.component.css'],
  standalone: false,
})
export class PagesDetailsAccessibilityComponent {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);

  pageUrl$ = this.pageDetailsService.pageUrl$;
  currentLang = this.i18n.currentLang;
  url = toSignal(this.pageUrl$);

  accessibilityData = toSignal(this.pageDetailsService.accessibility$);
  accessibilityError = toSignal(this.pageDetailsService.accessibilityError$);
  private _accessibilityLoading = toSignal(
    this.pageDetailsService.accessibilityLoading$,
  );

  private manualCriteriaSection =
    viewChild<ElementRef<HTMLElement>>('manualCriteriaSection');

  readonly automatedCriteriaCount = AUTOMATED_CRITERIA_COUNT;
  readonly wcagCriteriaCount = WCAG_AA_CRITERIA_COUNT;
  readonly manualCriteriaCount = MANUAL_CRITERIA.length;

  /**
   * English links to the Understanding page, which explains how to test the criterion;
   * W3C publishes no French Understanding, so French links to the authorized
   * translation of the Recommendation instead.
   */
  manualCriteria = computed(() => {
    const isFrench = this.currentLang() === 'fr-CA';

    return MANUAL_CRITERIA.map((criterion) => ({
      num: criterion.num,
      level: criterion.level,
      title: isFrench ? criterion.fr : criterion.en,
      url: isFrench
        ? `https://www.w3.org/Translations/WCAG22-fr/#${criterion.slug}`
        : `https://www.w3.org/WAI/WCAG22/Understanding/${criterion.slug}.html`,
    }));
  });

  readonly viewportLabels: Record<string, string> = {
    desktop: 'accessibility-viewport-desktop',
    mobile: 'accessibility-viewport-mobile',
  } satisfies Record<AccessibilityViewport, string>;

  readonly detailedCategories: Record<string, boolean> = {
    failed: true,
    manual_check: true,
  };

  readonly categoryLabels: Record<string, string> = {
    failed: 'accessibility-failed-tests',
    manual_check: 'accessibility-manual-checks',
    passed: 'accessibility-passed-tests',
    not_applicable: 'accessibility-not-applicable',
  } satisfies Record<AccessibilityAudit['category'], string>;

  readonly levelClasses: Record<string, string> = {
    A: 'border text-muted',
    AA: 'border text-muted',
    AAA: 'border text-muted',
    'best-practice': 'bg-warning text-dark',
  };

  readonly impactClasses: Record<string, string> = {
    critical: 'text-danger',
    serious: 'text-danger',
    moderate: 'text-warning',
    minor: 'text-muted',
  } satisfies Record<AccessibilityImpact, string>;

  isTestRunning = computed(
    () => this._accessibilityLoading() && !this.accessibilityData(),
  );

  errorMessage = computed(() => {
    const error = this.accessibilityError();
    return error ? this.i18n.service.instant(error) : '';
  });

  testResults = computed(() => {
    const data = this.accessibilityData();
    const langKey = this.currentLang() === 'fr-CA' ? 'fr' : 'en';

    return data?.[langKey] ?? null;
  });

  private viewportResults = computed(() => this.testResults()?.data ?? null);

  private auditedViewports = computed(() => {
    const data = this.viewportResults();

    return data ? VIEWPORTS.filter((viewport) => data[viewport]) : [];
  });

  /**
   * One self-contained report per viewport — overview, metrics and findings — so that
   * each tab describes a single screen size. A merged view produced contradictory
   * statuses, because the ARIA rules are `not_applicable` on desktop and `passed` on
   * mobile, where canada.ca serves the markup they test.
   */
  viewportReports = computed(() => {
    const data = this.viewportResults();

    if (!data) {
      return null;
    }

    return this.auditedViewports().map((viewport) => {
      const audits = data[viewport]?.audits ?? [];
      const categorized = this.categorize(audits);
      const table = this.tableFor(categorized);

      return {
        viewport,
        scoreDisplay: data[viewport]?.scoreDisplay ?? '',
        testedAt: data[viewport]?.testedAt,
        verdict: this.verdictFor(categorized.failed),
        categorized,
        metrics: this.metricsFor(categorized),
        table,
        chart: this.chartFor(table),
      };
    });
  });

  /**
   * AAA and experimental results are split out rather than filtered by category, so
   * they can never reach the score, the conformance verdict or the failure counts.
   */
  private categorize(audits: AccessibilityAudit[]): CategorizedAudits {
    const scored = audits.filter(
      (audit) =>
        !audit.experimental &&
        audit.conformanceLevel !== 'AAA' &&
        !audit.advisory,
    );

    const failed = scored
      .filter((audit) => audit.category === 'failed')
      .sort(this.byConformanceThenImpact);

    /**
     * axe evaluates per node, so a rule with both failing and passing nodes comes back
     * in `violations` *and* `passes`. Counting it in both buckets would count one rule
     * twice in `totalAutomated` and credit a failing rule as a pass.
     */
    const failedIds = new Set(failed.map((audit) => audit.id));

    return {
      failed,
      manual: scored
        .filter((audit) => audit.category === 'manual_check')
        .sort(this.byConformanceThenImpact),
      passed: scored.filter(
        (audit) => audit.category === 'passed' && !failedIds.has(audit.id),
      ),
      notApplicable: scored.filter(
        (audit) => audit.category === 'not_applicable',
      ),
      advisory: audits.filter(
        (audit) =>
          !audit.experimental &&
          audit.conformanceLevel !== 'AAA' &&
          audit.advisory,
      ),
      reference: audits.filter(
        (audit) => !audit.experimental && audit.conformanceLevel === 'AAA',
      ),
      experimental: audits.filter((audit) => audit.experimental),
    };
  }

  /**
   * Conformance failures sort above best-practice ones, so what actually breaks WCAG
   * is read first; impact orders each group. Best-practice rules carry no criterion
   * and cannot affect conformance, which is why the verdict count and the Failed tab
   * count legitimately differ.
   */
  private byConformanceThenImpact = (
    a: AccessibilityAudit,
    b: AccessibilityAudit,
  ): number => {
    const blocking = (audit: AccessibilityAudit) =>
      audit.conformanceLevel === 'A' || audit.conformanceLevel === 'AA' ? 0 : 1;

    return (
      blocking(a) - blocking(b) ||
      (IMPACT_ORDER[a.impact ?? ''] ?? 9) - (IMPACT_ORDER[b.impact ?? ''] ?? 9)
    );
  };

  /**
   * WCAG conformance is binary: a single Level A or AA failure means the page does
   * not conform, however high the score. Best-practice failures carry no criterion
   * and so cannot affect conformance.
   */
  private verdictFor(failed: AccessibilityAudit[]) {
    const blocking = failed.filter(
      (audit) =>
        audit.conformanceLevel === 'A' || audit.conformanceLevel === 'AA',
    );

    return {
      conformant: blocking.length === 0,
      blockingCount: blocking.length,
      affectedElements: blocking.reduce(
        (total, audit) => total + (audit.affectedCount ?? 0),
        0,
      ),
      bestPracticeCount: failed.length - blocking.length,
    };
  }

  private metricsFor(categorized: CategorizedAudits) {
    const automatedTestable =
      categorized.failed.length + categorized.passed.length;

    return {
      totalAutomated: automatedTestable,
      failed: categorized.failed.length,
      passed: categorized.passed.length,
      passRate:
        automatedTestable > 0
          ? Math.round((categorized.passed.length / automatedTestable) * 100)
          : 0,
      manualChecks: categorized.manual.length,
      manualElements: categorized.manual.reduce(
        (total, audit) => total + (audit.affectedCount ?? 0),
        0,
      ),
      notApplicable: categorized.notApplicable.length,
      advisory: categorized.advisory.length,
      reference: categorized.reference.length,
      experimental: categorized.experimental.length,
    };
  }

  private tableFor(categorized: CategorizedAudits): AuditTableRow[] {
    return [
      {
        category: 'accessibility-failed-tests',
        count: categorized.failed.length,
      },
      {
        category: 'accessibility-passed-tests',
        count: categorized.passed.length,
      },
      {
        category: 'accessibility-manual-checks',
        count: categorized.manual.length,
      },
      {
        category: 'accessibility-not-applicable',
        count: categorized.notApplicable.length,
      },
    ];
  }

  private chartFor(table: AuditTableRow[]) {
    const colors = [
      FAILED_SERIES_COLOUR,
      globalColours[2],
      globalColours[1],
      globalColours[0],
    ];

    const populated = table.reduce(
      (acc, { category, count }, index) => {
        if (count > 0) {
          acc.series.push(count);
          acc.labels.push(this.i18n.service.instant(category));
          acc.colors.push(colors[index]);
        }
        return acc;
      },
      { series: [] as number[], labels: [] as string[], colors: [] as string[] },
    );

    if (populated.series.length === 0) {
      return {
        series: [{ name: 'Audits', data: [1] }],
        labels: [this.i18n.service.instant('accessibility-no-data')],
        colors: [globalColours[0]],
      };
    }

    return {
      series: [{ name: 'Audits', data: populated.series }],
      labels: populated.labels,
      colors: populated.colors,
    };
  }

  auditTableCols = computed<ColumnConfig<AuditTableRow>[]>(() => [
    {
      field: 'category',
      header: 'category',
      translate: true,
    },
    {
      field: 'count',
      header: 'count',
      pipe: 'number',
    },
  ]);

  getDequeUrl(audit: AccessibilityAudit): string {
    const baseUrl =
      audit.helpUrl ||
      `https://dequeuniversity.com/rules/axe/latest/${audit.id}`;

    if (this.currentLang() === 'fr-CA') {
      return baseUrl.includes('?')
        ? `${baseUrl}&lang=fr`
        : `${baseUrl}?lang=fr`;
    }

    return baseUrl;
  }

  /**
   * A plain fragment href is resolved by the router against the base URL and lands on
   * the default route, so the jump is done here instead. Focus follows the scroll so
   * the link behaves for keyboard users, not just visually.
   */
  scrollToManualCriteria(event: Event) {
    event.preventDefault();

    const section = this.manualCriteriaSection()?.nativeElement;

    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section?.focus({ preventScroll: true });
  }

  runAccessibilityTest() {
    const currentUrl = this.url();

    if (currentUrl) {
      this.pageDetailsService.refreshAccessibilityTest(currentUrl);
    }
  }
}
