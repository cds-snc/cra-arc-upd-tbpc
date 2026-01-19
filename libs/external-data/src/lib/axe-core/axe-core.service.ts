import { Injectable, Inject, ConsoleLogger } from '@nestjs/common';
import { AxeBuilder } from '@axe-core/playwright';
import axe from 'axe-core';
import { Retry } from '@dua-upd/utils-common';
import { AxeCoreClient } from './axe-core.client';
import { WCAG_TAGS, IMPACT_WEIGHTS, type ImpactLevel } from './axe-core.types';
import type {
  AccessibilityAudit,
  AccessibilityAuditNode,
  AccessibilityTestResult,
} from '@dua-upd/types-common';
import type { AxeResults, Result, Locale } from 'axe-core';

// Import French locale for axe-core
import frLocale from 'axe-core/locales/fr.json';

// Create French axe source by appending locale configuration
const axeSourceDefault = axe.source;
const axeSourceFrench = `${axe.source};axe.configure(${JSON.stringify({ locale: frLocale })});`;

@Injectable()
export class AxeCoreService {
  constructor(
    @Inject(AxeCoreClient.name)
    private readonly client: AxeCoreClient,
    private readonly logger: ConsoleLogger,
  ) {}

  @Retry(3, 1000)
  async runAccessibilityTest(
    url: string,
    strategy: 'mobile' | 'desktop' = 'desktop',
    locale?: string,
  ): Promise<AccessibilityTestResult> {
    this.logger.log(
      `Running axe-core accessibility test for ${url} (${strategy}) with locale: ${locale}`,
    );

    let context = null;
    let page = null;

    try {
      context = await this.client.createContext();
      page = await this.client.createPage(context);

      // Set viewport based on strategy
      if (strategy === 'mobile') {
        await page.setViewportSize({ width: 375, height: 812 });
      } else {
        await page.setViewportSize({ width: 1920, height: 1080 });
      }

      // Navigate to URL - use domcontentloaded (faster, sufficient for DOM testing)
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Select axe source based on locale (French or default English)
      const isFrench = locale?.startsWith('fr');
      const axeSource = isFrench ? axeSourceFrench : axeSourceDefault;

      // Run axe-core analysis with WCAG tags and appropriate locale
      const results: AxeResults = await new AxeBuilder({ page, axeSource })
        .withTags([...WCAG_TAGS])
        .analyze();

      // Map results to our AccessibilityTestResult type
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
      // Clean up resources
      if (page) {
        await page.close().catch(() => {});
      }
      if (context) {
        await context.close().catch(() => {});
      }
    }
  }

  async runAccessibilityTestDesktopOnly(
    url: string,
    locale?: string,
  ): Promise<AccessibilityTestResult> {
    return await this.runAccessibilityTest(url, 'desktop', locale);
  }

  async runAccessibilityTestForBothLocales(url: string): Promise<{
    en: AccessibilityTestResult;
    fr: AccessibilityTestResult;
  }> {
    // Run English and French tests in parallel for faster execution
    const [enResults, frResults] = await Promise.all([
      this.runAccessibilityTestDesktopOnly(url, 'en-US'),
      this.runAccessibilityTestDesktopOnly(url, 'fr-CA'),
    ]);

    return { en: enResults, fr: frResults };
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
    // Map nodes to AccessibilityAuditNode array
    const nodes: AccessibilityAuditNode[] = result.nodes.map((node) => ({
      html: node.html,
      target: node.target.map((t) => (Array.isArray(t) ? t.join(' ') : t)),
      failureSummary: node.failureSummary,
    }));

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
}
