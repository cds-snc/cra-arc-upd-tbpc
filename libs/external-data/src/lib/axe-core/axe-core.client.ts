import { type Browser, type BrowserContext, chromium } from 'playwright';

export class AxeCoreClient {
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    if (!this.browserPromise) {
      this.browserPromise = this.initBrowser();
    }

    return this.browserPromise;
  }

  private async initBrowser(): Promise<Browser> {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      return this.browser;
    } catch (err) {
      // a failed launch must not poison every later request with the rejected promise
      this.browserPromise = null;
      throw err;
    }
  }

  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();

    return browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
    }
  }
}
