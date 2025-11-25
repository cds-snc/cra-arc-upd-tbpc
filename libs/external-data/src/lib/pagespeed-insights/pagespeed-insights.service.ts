import { Injectable, Inject, ConsoleLogger } from '@nestjs/common';
import { wait } from '@dua-upd/utils-common';
import { Retry } from '@dua-upd/utils-common';
import { PageSpeedInsightsClient } from './pagespeed-insights.client';
import type { AccessibilityAudit, AccessibilityTestResult } from '@dua-upd/types-common';

@Injectable()
export class PageSpeedInsightsService {
  constructor(
    @Inject(PageSpeedInsightsClient.name)
    private readonly client: PageSpeedInsightsClient,
    private readonly logger: ConsoleLogger,
  ) {}

  @Retry(3, 1000)
  async runAccessibilityTest(
    url: string,
    strategy: 'mobile' | 'desktop' = 'desktop',
    locale?: string
  ): Promise<AccessibilityTestResult> {
    this.logger.log(`Running accessibility test for ${url} (${strategy}) with locale: ${locale}`);

    try {
      const response = await this.client.runPageSpeedTest({
        url,
        category: 'ACCESSIBILITY',
        strategy,
        locale,
      });

      if (!response?.lighthouseResult) {
        throw new Error('Invalid response from PageSpeed Insights API');
      }

      const { lighthouseResult } = response;
      const accessibilityCategory = lighthouseResult.categories?.accessibility;
      
      if (!accessibilityCategory) {
        throw new Error('No accessibility data in response');
      }

      const score = accessibilityCategory.score;
      const scoreDisplay = score !== null ? `${Math.round(score * 100)}%` : 'N/A';

      // Process audits
      const audits: AccessibilityAudit[] = [];
      
      for (const auditRef of accessibilityCategory.auditRefs) {
        const audit = lighthouseResult.audits[auditRef.id];
        if (!audit) continue;

        // Categorize the audit
        const category = this.categorizeAudit(audit.score, audit.scoreDisplayMode);
        
        // Extract snippet if available
        let snippet: string | undefined;
        const items = audit.details?.items;
        if (items && items.length > 0) {
          const firstItem = items[0];
          snippet = firstItem.node?.snippet || firstItem.snippet;
        }

        // Extract help URL from description field
        // Match both English "Learn" and French "En savoir plus" or any text in square brackets
        const helpUrl = audit.description.match(/\[[^\]]+\]\((https:\/\/dequeuniversity\.com[^)]+)\)/)?.[1];

        audits.push({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayMode: audit.scoreDisplayMode,
          category,
          snippet,
          helpUrl,
        });
      }

      return {
        url,
        strategy,
        score: score || 0,
        scoreDisplay,
        audits,
        testedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to run accessibility test for ${url}:`, error);
      throw error;
    }
  }

  async runAccessibilityTestDesktopOnly(url: string, locale?: string): Promise<AccessibilityTestResult> {
    // Run desktop test only
    return await this.runAccessibilityTest(url, 'desktop', locale);
  }

  async runAccessibilityTestForBothLocales(url: string): Promise<{
    en: AccessibilityTestResult;
    fr: AccessibilityTestResult;
  }> {
    // Run English test for desktop only
    const enResults = await this.runAccessibilityTestDesktopOnly(url, 'en-US');

    // Wait to avoid rate limiting
    await wait(800);

    // Run French test for desktop only
    const frResults = await this.runAccessibilityTestDesktopOnly(url, 'fr-CA');

    return { en: enResults, fr: frResults };
  }

  private categorizeAudit(
    score: number | null,
    displayMode: string
  ): AccessibilityAudit['category'] {
    if (score === 0 && displayMode === 'binary') {
      return 'failed';
    } else if (displayMode === 'manual' || displayMode === 'informative') {
      return 'manual_check';
    } else if (score === 1 && displayMode === 'binary') {
      return 'passed';
    } else if (displayMode === 'notApplicable') {
      return 'not_applicable';
    } else {
      return 'not_applicable';
    }
  }

}