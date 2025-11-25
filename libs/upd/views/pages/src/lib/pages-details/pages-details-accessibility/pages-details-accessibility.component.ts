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

  private manualVerificationMapping: { [key: string]: string } = {
    'Interactive controls are keyboard focusable': 'accessibility-manual-interactive-control',
    'Interactive elements indicate their purpose and state': 'accessibility-manual-interactive-elements',
    'The page has a logical tab order': 'accessibility-manual-logical-tab',
    'Visual order on the page follows DOM order': 'accessibility-manual-dom-order',
    'User focus is not accidentally trapped in a region': 'accessibility-manual-focus-trap',
    'The user\'s focus is directed to new content added to the page': 'accessibility-manual-new-content',
    'HTML5 landmark elements are used to improve navigation': 'accessibility-manual-html5-landmark',
    'Offscreen content is hidden from assistive technology': 'accessibility-manual-offscreen-content',
    'Custom controls have associated labels': 'accessibility-manual-custom-control',
    'Custom controls have ARIA roles': 'accessibility-manual-aria-roles'
  };


  getCategorizedAudits(audits: AccessibilityAudit[]) {
    const processedAudits = audits.map(audit => {
      if (audit.category === 'manual_check') {
        const translationKey = this.manualVerificationMapping[audit.title];
        if (translationKey) {
          return {
            ...audit,
            title: this.translateService.instant(translationKey),
            description: this.translateService.instant(`${translationKey}-description`)
          };
        }
      }
      return audit;
    });

    return {
      failed: processedAudits.filter(audit => audit.category === 'failed'),
      passed: processedAudits.filter(audit => audit.category === 'passed'),
      manual: processedAudits.filter(audit => audit.category === 'manual_check'),
      notApplicable: processedAudits.filter(audit => audit.category === 'not_applicable')
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
}