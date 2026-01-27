import { Component, inject, computed, SecurityContext, signal } from '@angular/core';
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
  AccessibilityTestResult,
} from '@dua-upd/types-common';

type DeviceTab = 'desktop' | 'mobile';

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

  currentLang = toSignal(this.i18n.currentLang$);
  url = toSignal(this.pageDetailsService.pageUrl$);

  accessibilityData = toSignal(this.pageDetailsService.accessibility$);
  accessibilityError = toSignal(this.pageDetailsService.accessibilityError$);
  private _accessibilityLoading = toSignal(this.pageDetailsService.accessibilityLoading$);

  isTestRunning = computed(() => {
    const data = this.accessibilityData();
    const loading = this._accessibilityLoading();
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

  selectedDevice = signal<DeviceTab>('desktop');

  currentDeviceData = computed<AccessibilityTestResult | null>(() => {
    const results = this.testResults();
    const device = this.selectedDevice();
    return results?.data?.[device] ?? null;
  });

  hasDesktopData = computed(() => !!this.testResults()?.data?.desktop);
  hasMobileData = computed(() => !!this.testResults()?.data?.mobile);

  chartData = computed(() => {
    const deviceData = this.currentDeviceData();
    if (deviceData?.audits) {
      return this.getAuditDistributionData(deviceData.audits);
    }
    return null;
  });

  metrics = computed(() => {
    const deviceData = this.currentDeviceData();
    if (deviceData?.audits) {
      return this.getAutomatedTestMetrics(deviceData.audits);
    }
    return null;
  });

  readonly auditTableCols: ColumnConfig<{ category: string; count: number }>[] = [
    {
      field: 'category',
      header: 'Category',
      translate: true,
    },
    {
      field: 'count',
      header: 'count',
      translate: true,
      pipe: 'number',
    }
  ];

  auditTableData = computed(() => {
    const deviceData = this.currentDeviceData();
    if (!deviceData?.audits) return null;

    const categorized = this.getCategorizedAudits(deviceData.audits);
    return [
      { category: 'accessibility-failed-tests', count: categorized.failed.length },
      { category: 'accessibility-passed-tests', count: categorized.passed.length },
      { category: 'accessibility-manual-checks', count: categorized.manual.length },
      { category: 'accessibility-not-applicable', count: categorized.notApplicable.length }
    ];
  });

  private readonly impactOrder: Record<string, number> = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
  };

  categorizedAudits = computed(() => {
    const deviceData = this.currentDeviceData();
    if (!deviceData?.audits) return null;

    const categorized = this.getCategorizedAudits(deviceData.audits);

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
    return audits.reduce(
      (acc, audit) => {
        switch (audit.category) {
          case 'failed':
            acc.failed.push(audit);
            break;
          case 'passed':
            acc.passed.push(audit);
            break;
          case 'manual_check':
            acc.manual.push(audit);
            break;
          case 'not_applicable':
            acc.notApplicable.push(audit);
            break;
        }
        return acc;
      },
      {
        failed: [] as AccessibilityAudit[],
        passed: [] as AccessibilityAudit[],
        manual: [] as AccessibilityAudit[],
        notApplicable: [] as AccessibilityAudit[],
      }
    );
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
      // Validate URL is HTTP/HTTPS to prevent XSS via javascript: or data: URLs
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        return linkText;
      }

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

  selectDevice(device: DeviceTab) {
    this.selectedDevice.set(device);
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