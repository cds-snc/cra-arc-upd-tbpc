import axios from 'axios';

export type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class OpenRouterClient {
  private readonly apiEndpoint = 'https://openrouter.ai/api/v1/chat/completions';

  async createCompletion(messages: OpenRouterMessage[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured.');
    }

    const response = await axios.post<OpenRouterResponse>(
      this.apiEndpoint,
      {
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages,
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(process.env.OPENROUTER_SITE_URL && {
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
          }),
          ...(process.env.OPENROUTER_APP_NAME && {
            'X-Title': process.env.OPENROUTER_APP_NAME,
          }),
        },
        timeout: 30000,
      },
    );

    const content = response.data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('OpenRouter returned no analysis content.');
    }

    return content;
  }
}