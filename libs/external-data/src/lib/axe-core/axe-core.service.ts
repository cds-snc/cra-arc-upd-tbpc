import {
  type BeforeApplicationShutdown,
  ConsoleLogger,
  Inject,
  Injectable,
} from '@nestjs/common';
import AxeBuilder from '@axe-core/playwright';
import type { AxeResults, NodeResult, Result } from 'axe-core';
import frLocale from 'axe-core/locales/fr.json';
import { Retry } from '@dua-upd/utils-common';
import type {
  AccessibilityAudit,
  AccessibilityAuditNode,
  AccessibilityCheckResult,
  AccessibilityConformanceLevel,
  AccessibilityImpact,
  AccessibilityTestResult,
} from '@dua-upd/types-common';
import { AxeCoreClient } from './axe-core.client';
import {
  CONFORMANCE_LEVEL_TAGS,
  EXCLUDED_SELECTORS,
  IMPACT_WEIGHTS,
  OPT_IN_RULE_OPTIONS,
  STORED_HTML_DISABLED_RULES,
  UNSCORED_LEVELS,
  WCAG_TAGS,
  type AxeAuditSource,
  type StoredHtmlSnapshot,
} from './axe-core.types';
import {
  assertAuditableUrl,
  getUrlLang,
  isAnalyticsRequest,
  rebuildDocument,
} from './axe-core.utils';

const wcagTagRegex = /^wcag(\d)(\d)(\d+)?$/;

const checkTypes = ['any', 'all', 'none'] as const;

const categoryScores: Record<
  AccessibilityAudit['category'],
  { score: number | null; displayMode: string }
> = {
  failed: { score: 0, displayMode: 'binary' },
  passed: { score: 1, displayMode: 'binary' },
  manual_check: { score: null, displayMode: 'manual' },
  not_applicable: { score: null, displayMode: 'notApplicable' },
};

const frRules = (
  frLocale as {
    rules: Record<string, { help?: string; description?: string }>;
  }
).rules;

export type AxeAuditOptions = {
  withScripts?: boolean;
  settleMs?: number;
};

@Injectable()
export class AxeCoreService implements BeforeApplicationShutdown {
  constructor(
    @Inject(AxeCoreClient.name)
    private readonly client: AxeCoreClient,
    private readonly logger: ConsoleLogger,
  ) {}

  async beforeApplicationShutdown() {
    return await this.client.close();
  }

  @Retry(3, 1000)
  async runAccessibilityTest(
    url: string,
    options: AxeAuditOptions = {},
  ): Promise<AccessibilityTestResult> {
    return this.audit({ kind: 'url', url }, options);
  }

  async runAccessibilityTestForStoredHtml(
    url: string,
    { html, title, lang }: StoredHtmlSnapshot,
    options: AxeAuditOptions = {},
  ): Promise<AccessibilityTestResult> {
    return this.audit({ kind: 'html', url, html, title, lang }, options);
  }

  async runAccessibilityTestForBothLocales(
    url: string,
    options: AxeAuditOptions = {},
  ): Promise<{ en: AccessibilityTestResult; fr: AccessibilityTestResult }> {
    const en = await this.runAccessibilityTest(url, options);

    return { en, fr: this.translateResultToFrench(en) };
  }

  private async audit(
    source: AxeAuditSource,
    { withScripts = true, settleMs = 2500 }: AxeAuditOptions,
  ): Promise<AccessibilityTestResult> {
    this.logger.log(`Running accessibility test for ${source.url}`);

    if (source.kind === 'url') {
      assertAuditableUrl(source.url);
    }

    const context = await this.client.createContext();

    try {
      const page = await context.newPage();

      await page.route('**/*', (route) => {
        const request = route.request();

        if (isAnalyticsRequest(request.url())) {
          return route.abort();
        }

        if (!withScripts && request.resourceType() === 'script') {
          return route.abort();
        }

        return route.continue();
      });

      if (source.kind === 'url') {
        const response = await page.goto(source.url, { waitUntil: 'load' });

        // without this an error page would be audited and scored as if it were the page
        if (response && !response.ok()) {
          throw new Error(
            `Navigation failed with status ${response.status()} for ${source.url}`,
          );
        }
      } else {
        const lang = source.lang || getUrlLang(source.url);

        await page.setContent(
          rebuildDocument(source.html, lang, {
            withScripts,
            title: source.title,
          }),
          { waitUntil: withScripts ? 'networkidle' : 'load' },
        );
      }

      // WET-BOEW enhances markup after load; auditing before it settles misses
      // the ARIA attributes and elements it generates
      if (withScripts && settleMs > 0) {
        await page.waitForTimeout(settleMs);
      }

      const rules =
        source.kind === 'html' && !source.title
          ? { ...OPT_IN_RULE_OPTIONS, ...STORED_HTML_DISABLED_RULES }
          : OPT_IN_RULE_OPTIONS;

      const builder = EXCLUDED_SELECTORS.reduce(
        (acc, selector) => acc.exclude(selector),
        new AxeBuilder({ page }).options({
          runOnly: { type: 'tag', values: [...WCAG_TAGS] },
          rules,
        }),
      );

      const results = await builder.analyze();

      return this.mapResults(source.url, results);
    } catch (error) {
      this.logger.error(
        `Failed to run accessibility test for ${source.url}:`,
        error,
      );
      throw error;
    } finally {
      await context.close();
    }
  }

  private mapResults(
    url: string,
    results: AxeResults,
  ): AccessibilityTestResult {
    const score = this.calculateScore(results);

    return {
      url,
      strategy: 'desktop',
      score,
      scoreDisplay: `${Math.round(score * 100)}%`,
      audits: this.mapAxeResultsToAudits(results),
      testedAt: new Date(),
    };
  }

  private mapAxeResultsToAudits(results: AxeResults): AccessibilityAudit[] {
    return [
      ...results.violations.map((r) => this.mapResultToAudit(r, 'failed')),
      ...results.passes.map((r) => this.mapResultToAudit(r, 'passed')),
      ...results.incomplete.map((r) =>
        this.mapResultToAudit(r, 'manual_check'),
      ),
      ...results.inapplicable.map((r) =>
        this.mapResultToAudit(r, 'not_applicable'),
      ),
    ];
  }

  private mapResultToAudit(
    result: Result,
    category: AccessibilityAudit['category'],
  ): AccessibilityAudit {
    const nodes = result.nodes.map((node) => this.mapNode(node));

    return {
      id: result.id,
      title: result.help,
      description: result.description,
      ...categoryScores[category],
      category,
      snippet: nodes[0]?.html,
      selector: nodes[0]?.target.join(' '),
      impact: (result.impact as AccessibilityImpact) || undefined,
      tags: result.tags,
      helpUrl: result.helpUrl,
      nodes,
      conformanceLevel: this.getConformanceLevel(result.tags),
      wcagCriteria: this.extractWcagCriteria(result.tags),
      howToFix: nodes[0]?.failureSummary,
      affectedCount: nodes.length,
    };
  }

  private mapNode(node: NodeResult): AccessibilityAuditNode {
    const checkResults: AccessibilityCheckResult[] = checkTypes.flatMap(
      (checkType) =>
        (node[checkType] || []).map(({ id, data }) => ({
          id,
          data,
          checkType,
        })),
    );

    return {
      html: node.html,
      target: node.target.map((t) => (Array.isArray(t) ? t.join(' ') : t)),
      failureSummary: node.failureSummary,
      checkResults: checkResults.length ? checkResults : undefined,
    };
  }

  private getConformanceLevel(
    tags: string[],
  ): AccessibilityConformanceLevel | undefined {
    return CONFORMANCE_LEVEL_TAGS.find(([, levelTags]) =>
      levelTags.some((tag) => tags.includes(tag)),
    )?.[0];
  }

  private isScored(tags: string[]): boolean {
    const level = this.getConformanceLevel(tags);

    return !level || !UNSCORED_LEVELS.includes(level);
  }

  private extractWcagCriteria(tags: string[]): string[] {
    const criteria = tags.reduce<string[]>((acc, tag) => {
      const match = wcagTagRegex.exec(tag);

      if (match) {
        const [, principle, guideline, criterion] = match;

        acc.push(
          criterion
            ? `${principle}.${guideline}.${criterion}`
            : `${principle}.${guideline}`,
        );
      }

      return acc;
    }, []);

    return [...new Set(criteria)];
  }

  private calculateScore(results: AxeResults): number {
    const scored = (rules: Result[]) =>
      rules.filter(({ tags }) => this.isScored(tags));

    const passedWeight = this.totalImpactWeight(scored(results.passes));
    const totalWeight =
      passedWeight + this.totalImpactWeight(scored(results.violations));

    return totalWeight === 0 ? 1 : passedWeight / totalWeight;
  }

  private totalImpactWeight(results: Result[]): number {
    return results.reduce(
      (sum, { impact }) =>
        sum + this.getImpactWeight(impact as AccessibilityImpact),
      0,
    );
  }

  private getImpactWeight(impact: AccessibilityImpact | undefined): number {
    return (impact && IMPACT_WEIGHTS[impact]) || 1;
  }

  /**
   * axe-core ships locale files, so French output is a lookup rather than a second
   * run against the page.
   */
  private translateResultToFrench(
    result: AccessibilityTestResult,
  ): AccessibilityTestResult {
    return {
      ...result,
      audits: result.audits.map((audit) => ({
        ...audit,
        title: frRules[audit.id]?.help || audit.title,
        description: frRules[audit.id]?.description || audit.description,
      })),
    };
  }
}
