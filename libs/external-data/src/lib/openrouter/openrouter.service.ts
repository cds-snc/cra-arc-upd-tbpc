import { Inject, Injectable } from '@nestjs/common';
import type { PageHighlightsData } from '@dua-upd/types-common';
import { OpenRouterClient } from './openrouter.client';

@Injectable()
export class OpenRouterService {
  constructor(
    @Inject(OpenRouterClient.name)
    private readonly client: OpenRouterClient,
  ) {}

  async getPageHighlights(pageData: PageHighlightsData): Promise<string[]> {
    const content = await this.client.createCompletion([
      {
        role: 'system',
        content:
          "You are an analytics assistant summarizing a single web page's performance. " +
          'Given the page data provided, return 3 to 5 concise highlights (each under 25 words) ' +
          'about notable trends, changes vs. the comparison period, or anomalies. ' +
          'Only use metrics present in the data, do not invent numbers. ' +
          `Respond in ${pageData.language === 'fr' ? 'French' : 'English'}. ` +
          'Respond with ONLY a JSON array of strings, with no other text.',
      },
      {
        role: 'user',
        content: JSON.stringify(pageData),
      },
    ]);

    return parseHighlights(content);
  }
}

function parseHighlights(content: string): string[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);

      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // fall through to line-based parsing
    }
  }

  // fallback for non-JSON responses: treat each line as a highlight
  return content
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);
}