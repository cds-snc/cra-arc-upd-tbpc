import { Component, inject, computed, SecurityContext } from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { PagesDetailsFacade } from '../+state/pages-details.facade';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { globalColours } from '@dua-upd/utils-common';
import type {
  ColumnConfig,
  AccessibilityAudit,
  AccessibilityAuditNode,
} from '@dua-upd/types-common';

@Component({
    selector: 'upd-pages-details-accessibility',
    templateUrl: './pages-details-accessibility.component.html',
    styleUrls: ['./pages-details-accessibility.component.css'],
    standalone: false
})
export class PagesDetailsAccessibilityComponent {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);
  private sanitizer = inject(DomSanitizer);
  private translateService = inject(TranslateService);

  currentLang$ = this.i18n.currentLang$;
  pageUrl$ = this.pageDetailsService.pageUrl$;
  currentLang = toSignal(this.currentLang$);
  url = toSignal(this.pageUrl$);

  accessibilityData = toSignal(this.pageDetailsService.accessibility$);
  accessibilityError = toSignal(this.pageDetailsService.accessibilityError$);
  private _accessibilityLoading = toSignal(this.pageDetailsService.accessibilityLoading$);

  // Only show loading if we don't have cached data for current page
  isTestRunning = computed(() => {
    const data = this.accessibilityData();
    const loading = this._accessibilityLoading();
    // Show loading only if loading is true AND we don't have data yet
    return loading && !data;
  });

  errorMessage = computed(() => {
    const error = this.accessibilityError();
    return error ? this.translateService.instant(error) : '';
  });

  testResults = computed(() => {
    const data = this.accessibilityData();
    const lang = this.currentLang();
    const langKey = lang === 'fr-CA' ? 'fr' : 'en';

    if (data && data[langKey]) {
      return data[langKey];
    }
    return null;
  });

  desktopChartData = computed(() => {
    const results = this.testResults();
    if (results?.data?.desktop?.audits) {
      return this.getAuditDistributionData(results.data.desktop.audits);
    }
    return null;
  });

  desktopMetrics = computed(() => {
    const results = this.testResults();
    if (results?.data?.desktop?.audits) {
      return this.getAutomatedTestMetrics(results.data.desktop.audits);
    }
    return null;
  });

  auditTableCols = computed<ColumnConfig<{ category: string; count: number }>[]>(() => [
    {
      field: 'category',
      header: 'Category',
      translate: true,
    },
    {
      field: 'count',
      header: 'Count',
      pipe: 'number',
    }
  ]);

  auditTableData = computed(() => {
    const results = this.testResults();
    if (!results?.data?.desktop?.audits) return null;

    const categorized = this.getCategorizedAudits(results.data.desktop.audits);
    return [
      { category: 'accessibility-failed-tests', count: categorized.failed.length },
      { category: 'accessibility-passed-tests', count: categorized.passed.length },
      { category: 'accessibility-manual-checks', count: categorized.manual.length },
      { category: 'accessibility-not-applicable', count: categorized.notApplicable.length }
    ];
  });

  // Impact order for sorting (lower = more severe)
  private readonly impactOrder: Record<string, number> = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
  };

  // Categorized audits with failed tests sorted by impact severity
  categorizedAudits = computed(() => {
    const results = this.testResults();
    if (!results?.data?.desktop?.audits) return null;

    const categorized = this.getCategorizedAudits(results.data.desktop.audits);

    // Sort failed audits by impact severity
    const sortedFailed = [...categorized.failed].sort((a, b) => {
      const aOrder = this.impactOrder[a.impact || 'minor'] ?? 3;
      const bOrder = this.impactOrder[b.impact || 'minor'] ?? 3;
      return aOrder - bOrder;
    });

    return {
      ...categorized,
      failed: sortedFailed,
    };
  });

  // Impact breakdown for summary
  impactBreakdown = computed(() => {
    const categorized = this.categorizedAudits();
    if (!categorized) return null;

    const violations = categorized.failed;
    return {
      critical: violations.filter(v => v.impact === 'critical').length,
      serious: violations.filter(v => v.impact === 'serious').length,
      moderate: violations.filter(v => v.impact === 'moderate').length,
      minor: violations.filter(v => v.impact === 'minor').length,
    };
  });


  getCategorizedAudits(audits: AccessibilityAudit[]) {
    // axe-core provides titles and descriptions directly - no mapping needed
    return {
      failed: audits.filter(audit => audit.category === 'failed'),
      passed: audits.filter(audit => audit.category === 'passed'),
      manual: audits.filter(audit => audit.category === 'manual_check'),
      notApplicable: audits.filter(audit => audit.category === 'not_applicable')
    };
  }

  getAuditDistributionData(audits: AccessibilityAudit[]) {
    const categorized = this.getCategorizedAudits(audits);
    const values = [
      categorized.failed.length,
      categorized.passed.length,
      categorized.manual.length,
      categorized.notApplicable.length
    ];
    
    const labelKeys = [
      'accessibility-failed-tests',
      'accessibility-passed-tests',
      'accessibility-manual-checks',
      'accessibility-not-applicable'
    ];

    const colors = [
      '#df2929',
      globalColours[2],
      globalColours[1],
      globalColours[0]
    ];
    
    const filteredData = values.reduce((acc, value, index) => {
      if (value > 0) {
        acc.series.push(value);
        acc.labels.push(this.translateService.instant(labelKeys[index]));
        acc.colors.push(colors[index]);
      }
      return acc;
    }, { series: [] as number[], labels: [] as string[], colors: [] as string[] });
    
    if (filteredData.series.length === 0) {
      return {
        series: [{
          name: 'Audits',
          data: [1]
        }],
        labels: [this.translateService.instant('accessibility-no-data')],
        colors: [globalColours[0]]
      };
    }
    
    return {
      series: [{
        name: 'Audits',
        data: filteredData.series
      }],
      labels: filteredData.labels,
      colors: filteredData.colors
    };
  }

  getAutomatedTestMetrics(audits: AccessibilityAudit[]) {
    const categorized = this.getCategorizedAudits(audits);
    const automatedTestable = categorized.failed.length + categorized.passed.length;
    const passRate = automatedTestable > 0 ?
      Math.round((categorized.passed.length / automatedTestable) * 100) : 0;

    return {
      totalAutomated: automatedTestable,
      failed: categorized.failed.length,
      passed: categorized.passed.length,
      passRate,
      manualChecks: categorized.manual.length,
      notApplicable: categorized.notApplicable.length
    };
  }

  trackByAuditId(_index: number, audit: AccessibilityAudit): string {
    return audit.id;
  }

  getScoreClass(score: number): string {
    if (score > 0.5) return 'text-success';
    return 'text-danger';
  }

  getDequeUrl(audit: AccessibilityAudit): string {
    const baseUrl = audit.helpUrl || `https://dequeuniversity.com/rules/axe/latest/${audit.id}`;
    if (this.currentLang() === 'fr-CA') {
      return baseUrl.includes('?') ? `${baseUrl}&lang=fr` : `${baseUrl}?lang=fr`;
    }
    return baseUrl;
  }

  parseMarkdownLinks(description: string): SafeHtml {
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    const isEnglish = this.currentLang() === 'en-CA';

    const htmlDescription = description.replace(markdownLinkRegex, (_match, linkText, url) => {
      let processedUrl = url;
      if (!isEnglish && url.includes('https://developer.chrome.com/docs/lighthouse/accessibility')) {
        processedUrl = url.includes('?') ? `${url}&hl=fr` : `${url}?hl=fr`;
      }

      return `<a href="${processedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary">${linkText}</a>`;
    });

    return this.sanitizer.sanitize(SecurityContext.HTML, htmlDescription) || description;
  }


  runAccessibilityTest() {
    const currentUrl = this.url();
    if (currentUrl) {
      this.pageDetailsService.refreshAccessibilityTest(currentUrl);
    }
  }

  getImpactBadgeClass(impact: string | undefined): string {
    switch (impact) {
      case 'critical':
        return 'bg-danger';
      case 'serious':
        return 'bg-warning text-dark';
      case 'moderate':
        return 'bg-info';
      case 'minor':
      default:
        return 'bg-secondary';
    }
  }

  trackByNodeTarget(_index: number, node: AccessibilityAuditNode): string {
    return node.target.join(' ');
  }
}