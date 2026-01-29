import { Injectable, Inject, ConsoleLogger } from '@nestjs/common';
import { AxeBuilder } from '@axe-core/playwright';
import axe from 'axe-core';
import { Retry } from '@dua-upd/utils-common';
import { AxeCoreClient } from './axe-core.client';
import { WCAG_TAGS, IMPACT_WEIGHTS, type ImpactLevel } from './axe-core.types';
import type {
  AccessibilityAudit,
  AccessibilityAuditNode,
  AccessibilityCheckResult,
  AccessibilityTestResult,
} from '@dua-upd/types-common';
import type { AxeResults, Result } from 'axe-core';

// Import French locale for translation lookup (not for running axe-core)
import frLocale from 'axe-core/locales/fr.json';

// CSS selectors to exclude from accessibility testing (canada.ca template elements)
const EXCLUDED_SELECTORS = [
  '.global-header nav',   // Skip links in global header
  '#wb-tphp',             // Skip links list (directly targets the element)
  '.gcweb-menu',          // GC Web main menu
  '#wb-bc',               // Breadcrumb navigation
  '.gc-contextual nav',   // Footer contextual nav
  '.gc-main-footer nav',  // Main footer nav
  '.gc-sub-footer nav',   // Sub footer nav
  'header nav',           // Any nav in header
  'footer nav',           // Any nav in footer
];

@Injectable()
export class AxeCoreService {
  private static readonly BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',
  ];

  constructor(
    @Inject(AxeCoreClient.name)
    private readonly client: AxeCoreClient,
    private readonly logger: ConsoleLogger,
  ) {}

  private validateUrl(url: string): void {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP/HTTPS protocols are allowed');
    }

    const hostname = parsed.hostname.toLowerCase();
    for (const blocked of AxeCoreService.BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.startsWith(blocked)) {
        throw new Error('Access to internal networks is not allowed');
      }
    }
  }

  @Retry(3, 1000)
  async runAccessibilityTest(
    url: string,
    strategy: 'mobile' | 'desktop' = 'desktop',
  ): Promise<AccessibilityTestResult> {
    this.validateUrl(url);

    this.logger.log(
      `Running axe-core accessibility test for ${url} (${strategy})`,
    );

    let context = null;
    let page = null;

    try {
      context = await this.client.createContext();
      page = await this.client.createPage(context);

      if (strategy === 'mobile') {
        await page.setViewportSize({ width: 375, height: 812 });
      } else {
        await page.setViewportSize({ width: 1920, height: 1080 });
      }

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });

      // Additional wait to ensure JavaScript has fully rendered the page
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000); // Give JS time to render dynamic content

      // Build AxeBuilder with exclusions (exclude() must be called once per selector)
      let axeBuilder = new AxeBuilder({ page, axeSource: axe.source }).withTags([...WCAG_TAGS]);
      for (const selector of EXCLUDED_SELECTORS) {
        axeBuilder = axeBuilder.exclude(selector);
      }
      const results: AxeResults = await axeBuilder.analyze();

      // Debug logging
      this.logger.log(`Axe-core results for ${url}:`);
      this.logger.log(`  Violations: ${results.violations.length}`);
      this.logger.log(`  Passes: ${results.passes.length}`);
      this.logger.log(`  Incomplete: ${results.incomplete.length}`);
      this.logger.log(`  Inapplicable: ${results.inapplicable.length}`);
      if (results.violations.length > 0) {
        this.logger.log(`  Violation IDs: ${results.violations.map(v => v.id).join(', ')}`);
      }

      const audits = this.mapAxeResultsToAudits(results);
      const score = this.calculateScore(results);
      const scoreDisplay = `${Math.round(score * 100)}%`;

      return {
        url,
        strategy,
        score,
        scoreDisplay,
        audits,
        testedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to run axe-core test for ${url}:`, error);
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          this.logger.warn(`Failed to close page: ${e}`);
        }
      }
      if (context) {
        try {
          await context.close();
        } catch (e) {
          this.logger.warn(`Failed to close context: ${e}`);
        }
      }
    }
  }

  async runAccessibilityTestDesktopOnly(
    url: string,
  ): Promise<AccessibilityTestResult> {
    return await this.runAccessibilityTest(url, 'desktop');
  }

  async runAccessibilityTestMobileOnly(
    url: string,
  ): Promise<AccessibilityTestResult> {
    return await this.runAccessibilityTest(url, 'mobile');
  }

  async runAccessibilityTestForBothLocales(url: string): Promise<{
    en: { desktop: AccessibilityTestResult; mobile: AccessibilityTestResult };
    fr: { desktop: AccessibilityTestResult; mobile: AccessibilityTestResult };
  }> {
    // Run only 2 tests (desktop + mobile) in parallel
    // French translations are generated from locale file lookup, not by re-running axe-core
    const [desktop, mobile] = await Promise.all([
      this.runAccessibilityTest(url, 'desktop'),
      this.runAccessibilityTest(url, 'mobile'),
    ]);

    // Generate French versions by translating the audit text
    const frDesktop = this.translateResultToFrench(desktop);
    const frMobile = this.translateResultToFrench(mobile);

    return {
      en: { desktop, mobile },
      fr: { desktop: frDesktop, mobile: frMobile },
    };
  }

  /**
   * Map axe-core results to our AccessibilityAudit array
   */
  private mapAxeResultsToAudits(results: AxeResults): AccessibilityAudit[] {
    const audits: AccessibilityAudit[] = [];

    // Map violations (failed)
    for (const violation of results.violations) {
      audits.push(this.mapResultToAudit(violation, 'failed'));
    }

    // Map passes
    for (const pass of results.passes) {
      audits.push(this.mapResultToAudit(pass, 'passed'));
    }

    // Map incomplete (manual_check)
    for (const incomplete of results.incomplete) {
      audits.push(this.mapResultToAudit(incomplete, 'manual_check'));
    }

    // Map inapplicable
    for (const inapplicable of results.inapplicable) {
      audits.push(this.mapResultToAudit(inapplicable, 'not_applicable'));
    }

    return audits;
  }

  /**
   * Map a single axe-core Result to AccessibilityAudit
   */
  private mapResultToAudit(
    result: Result,
    category: AccessibilityAudit['category'],
  ): AccessibilityAudit {
    // Map nodes to AccessibilityAuditNode array, including raw check data for translation
    const nodes: AccessibilityAuditNode[] = result.nodes.map((node) => {
      // Extract check results from any/all/none arrays for translation support
      // For failed nodes, all checks in these arrays contribute to the failure message
      const checkResults: AccessibilityCheckResult[] = [
        ...(node.any || []).map(c => ({ id: c.id, data: c.data, checkType: 'any' as const })),
        ...(node.all || []).map(c => ({ id: c.id, data: c.data, checkType: 'all' as const })),
        ...(node.none || []).map(c => ({ id: c.id, data: c.data, checkType: 'none' as const })),
      ];

      return {
        html: node.html,
        target: node.target.map((t) => (Array.isArray(t) ? t.join(' ') : t)),
        failureSummary: node.failureSummary,
        checkResults: checkResults.length > 0 ? checkResults : undefined,
      };
    });

    // Extract WCAG criteria from tags (e.g., 'wcag143' -> '1.4.3')
    const wcagCriteria = this.extractWcagCriteria(result.tags);

    // Determine score based on category
    let score: number | null = null;
    let displayMode = 'notApplicable';

    if (category === 'failed') {
      score = 0;
      displayMode = 'binary';
    } else if (category === 'passed') {
      score = 1;
      displayMode = 'binary';
    } else if (category === 'manual_check') {
      score = null;
      displayMode = 'manual';
    }

    return {
      id: result.id,
      title: result.help,
      description: result.description,
      score,
      displayMode,
      category,
      snippet: nodes[0]?.html,
      selector: nodes[0]?.target.join(' '),
      impact: result.impact as ImpactLevel | undefined,
      tags: result.tags,
      helpUrl: result.helpUrl,
      nodes,
      wcagCriteria,
      howToFix: nodes[0]?.failureSummary,
      affectedCount: nodes.length,
    };
  }

  /**
   * Extract WCAG criteria numbers from axe-core tags
   * e.g., 'wcag143' -> '1.4.3', 'wcag21a' -> '2.1'
   */
  private extractWcagCriteria(tags: string[]): string[] {
    const criteria: string[] = [];

    for (const tag of tags) {
      // Match patterns like wcag143, wcag1411, etc.
      const match = tag.match(/^wcag(\d)(\d)(\d+)?$/);
      if (match) {
        const [, level, guideline, criterion] = match;
        if (criterion) {
          criteria.push(`${level}.${guideline}.${criterion}`);
        } else {
          criteria.push(`${level}.${guideline}`);
        }
      }
    }

    return [...new Set(criteria)]; // Remove duplicates
  }

  /**
   * Calculate overall score from violations/passes
   * Weight violations by impact (critical=10, serious=5, moderate=3, minor=1)
   * Score = passedWeight / totalWeight
   */
  private calculateScore(results: AxeResults): number {
    let passedWeight = 0;
    let totalWeight = 0;

    // Calculate passed weight
    for (const pass of results.passes) {
      const weight = this.getImpactWeight(pass.impact as ImpactLevel);
      passedWeight += weight;
      totalWeight += weight;
    }

    // Calculate violation weight
    for (const violation of results.violations) {
      const weight = this.getImpactWeight(violation.impact as ImpactLevel);
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 1; // No tests = 100%
    }

    return passedWeight / totalWeight;
  }

  /**
   * Get weight for an impact level
   */
  private getImpactWeight(impact: ImpactLevel | undefined): number {
    if (!impact) {
      return 1;
    }
    return IMPACT_WEIGHTS[impact] || 1;
  }

  /**
   * Translate an AccessibilityTestResult to French using the locale file lookup.
   * This avoids re-running axe-core just to get French output.
   */
  private translateResultToFrench(
    result: AccessibilityTestResult,
  ): AccessibilityTestResult {
    const frRules = (frLocale as { rules: Record<string, { help?: string; description?: string }> }).rules;

    return {
      ...result,
      audits: result.audits.map((audit) => ({
        ...audit,
        title: frRules[audit.id]?.help ?? audit.title,
        description: frRules[audit.id]?.description ?? audit.description,
        howToFix: audit.nodes?.[0]?.checkResults
          ? this.buildFrenchFailureSummary(audit.nodes[0].checkResults)
          : (audit.howToFix ? this.translateFailureSummaryFallback(audit.howToFix) : audit.howToFix),
        nodes: audit.nodes?.map((node) => ({
          ...node,
          failureSummary: node.checkResults
            ? this.buildFrenchFailureSummary(node.checkResults)
            : (node.failureSummary ? this.translateFailureSummaryFallback(node.failureSummary) : node.failureSummary),
        })),
      })),
    };
  }

  /**
   * Build a French failureSummary from raw check results.
   */
  private buildFrenchFailureSummary(checkResults: AccessibilityCheckResult[]): string {
    const frChecks = (frLocale as { checks: Record<string, unknown> }).checks;

    // Group checks by type
    const anyChecks = checkResults.filter(c => c.checkType === 'any');
    const allNoneChecks = checkResults.filter(c => c.checkType === 'all' || c.checkType === 'none');

    const messages: string[] = [];

    // Process "any" checks (fix ANY of the following)
    if (anyChecks.length > 0) {
      const anyMessages = anyChecks
        .map(check => this.renderFrenchCheckMessage(check.id, check.data, frChecks))
        .filter(Boolean);
      if (anyMessages.length > 0) {
        messages.push("Corriger l'un des éléments suivants :\n  " + anyMessages.join('\n  '));
      }
    }

    // Process "all"/"none" checks (fix ALL of the following)
    if (allNoneChecks.length > 0) {
      const allMessages = allNoneChecks
        .map(check => this.renderFrenchCheckMessage(check.id, check.data, frChecks))
        .filter(Boolean);
      if (allMessages.length > 0) {
        messages.push('Corriger tous les éléments suivants :\n  ' + allMessages.join('\n  '));
      }
    }

    return messages.join('\n');
  }

  /**
   * Render a French check message by looking up the template and substituting data.
   */
  private renderFrenchCheckMessage(
    checkId: string,
    data: unknown,
    frChecks: Record<string, unknown>,
  ): string {
    const checkLocale = frChecks[checkId] as {
      fail?: string | { singular?: string; plural?: string; default?: string; [key: string]: string | undefined };
    } | undefined;

    if (!checkLocale?.fail) {
      return ''; // No French translation available
    }

    // Get the template string
    let template: string;
    if (typeof checkLocale.fail === 'string') {
      template = checkLocale.fail;
    } else {
      // Handle object with singular/plural or default/specific keys
      const dataObj = data as Record<string, unknown> | undefined;
      const messageKey = dataObj?.messageKey as string | undefined;

      if (messageKey && checkLocale.fail[messageKey]) {
        template = checkLocale.fail[messageKey]!;
      } else if (checkLocale.fail.default) {
        template = checkLocale.fail.default;
      } else if (checkLocale.fail.singular) {
        // Use singular by default, could check data for count
        template = checkLocale.fail.singular;
      } else {
        // Get first available key
        const firstKey = Object.keys(checkLocale.fail)[0];
        template = firstKey ? checkLocale.fail[firstKey]! : '';
      }
    }

    if (!template) {
      return '';
    }

    // Substitute ${data.xxx} placeholders with actual values
    return this.substituteTemplateData(template, data);
  }

  /**
   * Substitute ${data.xxx} placeholders in a template with actual data values.
   * Mimics axe-core's processMessage behavior.
   */
  private substituteTemplateData(template: string, data: unknown): string {
    if (!data) {
      return template;
    }

    // If data is an array, axe-core adds a 'values' property = array.join(', ')
    // We need to mimic this behavior
    if (Array.isArray(data)) {
      const values = data.join(', ');
      return template.replace(/\$\{data\.values\}/g, values);
    }

    if (typeof data !== 'object') {
      return template;
    }

    const dataObj = data as Record<string, unknown>;

    return template.replace(/\$\{data\.(\w+)\}/g, (_match, key) => {
      // Use hasOwnProperty to avoid accessing prototype methods like Object.values
      if (!Object.prototype.hasOwnProperty.call(dataObj, key)) {
        return '';
      }
      const value = dataObj[key];
      if (value === undefined || value === null) {
        return '';
      }
      // Handle arrays by joining them
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    });
  }

  /**
   * Fallback: Translate axe-core failureSummary prefixes from English to French.
   * Used when raw check data is not available.
   */
  private translateFailureSummaryFallback(summary: string): string {
    return summary
      .replace('Fix all of the following:', 'Corriger tous les éléments suivants :')
      .replace('Fix any of the following:', "Corriger l'un des éléments suivants :");
  }
}
