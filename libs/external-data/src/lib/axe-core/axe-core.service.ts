import {
  type BeforeApplicationShutdown,
  ConsoleLogger,
  Inject,
  Injectable,
} from '@nestjs/common';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { AxeResults, NodeResult, Result } from 'axe-core';
import frLocale from 'axe-core/locales/fr.json';
import { Retry } from '@dua-upd/utils-common';
import type {
  AccessibilityAudit,
  AccessibilityViewportResults,
  AccessibilityAuditNode,
  AccessibilityCheckResult,
  AccessibilityConformanceLevel,
  AccessibilityImpact,
  AccessibilityTestResult,
} from '@dua-upd/types-common';
import { AxeCoreClient } from './axe-core.client';
import {
  AUDIT_VIEWPORTS,
  CONFORMANCE_LEVEL_TAGS,
  EXCLUDED_SELECTORS,
  IMPACT_WEIGHTS,
  MAX_AUDIT_NODES,
  NODE_DETAIL_CATEGORIES,
  OPT_IN_RULE_OPTIONS,
  STORED_HTML_DISABLED_RULES,
  UNMEASURABLE_MESSAGE_KEYS,
  UNSCORED_LEVELS,
  WCAG22_LEVEL_TAGS,
  WET_BOEW_READY_TIMEOUT_MS,
  WCAG_TAGS,
  type AccessibilityViewport,
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

const frRules = (
  frLocale as {
    rules: Record<string, { help?: string; description?: string }>;
  }
).rules;

export type AxeAuditOptions = {
  withScripts?: boolean;
  viewport?: AccessibilityViewport;
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

  /**
   * Both viewports run concurrently: navigation dominates and is IO-bound, so the
   * pair costs about the same wall-clock as one (13.3s vs 22.4s sequential).
   */
  async runAccessibilityTestForBothLocales(
    url: string,
    options: AxeAuditOptions = {},
  ): Promise<{ en: AccessibilityViewportResults; fr: AccessibilityViewportResults }> {
    const results = await Promise.all(
      AUDIT_VIEWPORTS.map((viewport) =>
        this.runAccessibilityTest(url, { ...options, viewport }),
      ),
    );

    const en = Object.fromEntries(
      AUDIT_VIEWPORTS.map((viewport, i) => [viewport, results[i]]),
    ) as AccessibilityViewportResults;

    const fr = Object.fromEntries(
      AUDIT_VIEWPORTS.map((viewport, i) => [
        viewport,
        this.translateResultToFrench(results[i]),
      ]),
    ) as AccessibilityViewportResults;

    return { en, fr };
  }

  private async audit(
    source: AxeAuditSource,
    { withScripts = true, viewport = 'desktop' }: AxeAuditOptions,
  ): Promise<AccessibilityTestResult> {
    this.logger.log(
      `Running accessibility test for ${source.url} (${viewport})`,
    );

    if (source.kind === 'url') {
      assertAuditableUrl(source.url);
    }

    const context = await this.client.createContext(viewport);

    try {
      const page = await context.newPage();

      await page.route('**/*', async (route) => {
        const request = route.request();

        if (isAnalyticsRequest(request.url())) {
          return route.abort();
        }

        if (!withScripts && request.resourceType() === 'script') {
          return route.abort();
        }

        if (await this.client.tryServeFromCache(route, source.url)) {
          return;
        }

        return route.continue();
      });

      if (source.kind === 'url') {
        const response = await page.goto(source.url, {
          waitUntil: 'domcontentloaded',
        });

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

      if (withScripts) {
        await this.waitForEnhancement(page);
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

      return this.mapResults(source.url, results, viewport);
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

  /**
   * Resolves once WET-BOEW reports itself ready, or when the wait times out, in which
   * case the page is audited as it stands rather than failing the whole run.
   */
  private async waitForEnhancement(page: Page): Promise<void> {
    try {
      await page.waitForFunction(
        // `globalThis` rather than `window`: this runs in the page, but it is
        // type-checked in a Node project with no DOM lib.
        () =>
          (globalThis as unknown as { wb?: { isReady?: boolean } }).wb
            ?.isReady === true,
        null,
        { timeout: WET_BOEW_READY_TIMEOUT_MS },
      );
    } catch {
      this.logger.warn(
        `WET-BOEW did not report ready within ${WET_BOEW_READY_TIMEOUT_MS}ms, auditing the page as it stands`,
      );
    }
  }

  private mapResults(
    url: string,
    results: AxeResults,
    viewport: AccessibilityViewport,
  ): AccessibilityTestResult {
    const score = this.calculateScore(results);

    return {
      url,
      viewport,
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
    const detailed = NODE_DETAIL_CATEGORIES.includes(category);
    const nodes = detailed
      ? result.nodes.slice(0, MAX_AUDIT_NODES).map((node) => this.mapNode(node))
      : undefined;
    const unmeasurableCount = detailed
      ? this.countUnmeasurableNodes(result.nodes) || undefined
      : undefined;

    return {
      id: result.id,
      title: result.help,
      description: result.description,
      category,
      snippet: nodes?.[0]?.html,
      selector: nodes?.[0]?.target.join(' '),
      impact: (result.impact as AccessibilityImpact) || undefined,
      tags: result.tags,
      helpUrl: result.helpUrl,
      nodes,
      conformanceLevel: this.getConformanceLevel(result.tags),
      experimental: this.isExperimental(result.tags) || undefined,
      advisory: this.isAdvisory(result.tags) || undefined,
      wcagCriteria: this.extractWcagCriteria(result.tags),
      howToFix: nodes?.[0]?.failureSummary,
      affectedCount: result.nodes.length,
      unmeasurableCount,
    };
  }

  private countUnmeasurableNodes(nodes: NodeResult[]): number {
    return nodes.filter((node) =>
      checkTypes.some((checkType) =>
        (node[checkType] || []).some(({ data }) =>
          UNMEASURABLE_MESSAGE_KEYS.includes(
            (data as { messageKey?: string } | undefined)?.messageKey ?? '',
          ),
        ),
      ),
    ).length;
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

  private isExperimental(tags: string[]): boolean {
    return tags.includes('experimental');
  }

  private isAdvisory(tags: string[]): boolean {
    return WCAG22_LEVEL_TAGS.some((tag) => tags.includes(tag));
  }

  private isScored(tags: string[]): boolean {
    if (this.isExperimental(tags) || this.isAdvisory(tags)) {
      return false;
    }

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

    const violations = scored(results.violations);
    const violatedIds = new Set(violations.map(({ id }) => id));

    const passedWeight = this.totalImpactWeight(
      scored(results.passes).filter(({ id }) => !violatedIds.has(id)),
    );
    const totalWeight = passedWeight + this.totalImpactWeight(violations);

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
