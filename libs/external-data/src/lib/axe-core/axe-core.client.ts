import { Injectable, OnModuleDestroy, ConsoleLogger } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

/**
 * Manages Playwright browser lifecycle using singleton pattern.
 * - Lazy browser initialization on first request
 * - Context-per-request to avoid state pollution
 * - Implements OnModuleDestroy for cleanup
 */
@Injectable()
export class AxeCoreClient implements OnModuleDestroy {
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private readonly logger = new ConsoleLogger(AxeCoreClient.name);

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
    this.logger.log('Launching Chromium browser for axe-core testing');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
    return this.browser;
  }

  /**
   * Create a new browser context for isolated testing
   */
  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    return browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
  }

  /**
   * Create a new page within a context
   */
  async createPage(context: BrowserContext): Promise<Page> {
    return context.newPage();
  }

  /**
   * Clean up browser resources on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      this.logger.log('Closing Chromium browser');
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Check if browser is currently running
   */
  isBrowserRunning(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}
