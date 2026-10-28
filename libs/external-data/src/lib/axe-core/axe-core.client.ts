import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Route,
  chromium,
  devices,
} from 'playwright';
import type { AccessibilityViewport } from './axe-core.types';

type CachedAsset = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

/**
 * Only the origins we deliberately depend on are cached — canada.ca plus the CDN that
 * `WET_BOEW_SCRIPTS` loads jQuery from. `route.fetch()` performs its own TLS
 * verification and fails on hosts Chromium accepts (CRA's chatbot widget throws
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE), so everything else passes straight through.
 */
const CACHEABLE_ORIGINS = [
  'https://www.canada.ca/',
  'https://ajax.googleapis.com/',
  'https://fonts.gstatic.com/',
];

/**
 * Matched on the URL's extension rather than Chromium's `resourceType`, which mislabels
 * assets: WET-BOEW's `i18n/en.min.js`, `json-patch.min.js` and `jsonpointer.min.js` are
 * all reported as `image` and so were never cached.
 *
 * Images and media are deliberately absent. Those are per-page, so caching them would
 * grow without bound, and axe reads alt text from the DOM rather than pixels. Restricted
 * this way the cache stays flat as page count grows, because every page requests the
 * same template assets.
 */
const CACHEABLE_EXTENSIONS = /\.(?:js|mjs|css|woff2?|ttf|otf|eot)(?:\?|$)/i;

const MAX_CACHED_ASSETS = 200;

/**
 * The mobile user agent is load-bearing, not just the viewport width: canada.ca
 * serves markup for it that a desktop UA at the same width does not get, which
 * makes 6 more rules applicable. Playwright's descriptor is used rather than a
 * frozen profile so the UA tracks real Chrome — results may therefore shift
 * slightly across Playwright upgrades.
 */
const VIEWPORT_CONTEXTS: Record<AccessibilityViewport, BrowserContextOptions> = {
  desktop: { viewport: { width: 1920, height: 1080 } },
  mobile: devices['Pixel 5'],
};

export class AxeCoreClient {
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private assetCache = new Map<string, Promise<CachedAsset>>();

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

  async createContext(
    viewport: AccessibilityViewport = 'desktop',
  ): Promise<BrowserContext> {
    const browser = await this.getBrowser();

    return browser.newContext(VIEWPORT_CONTEXTS[viewport]);
  }

  /**
   * Assets are cached here rather than relying on the browser: a context is created and
   * closed per audit, and its HTTP cache dies with it, so every audit would start cold.
   * Keyed on URL and storing the **in-flight promise**, so the two viewports racing the
   * same asset fetch it once rather than twice.
   *
   * Returns true when the request was served from cache and needs no further handling.
   * Any failure returns false so the caller falls back to the network — a cache must
   * never be able to break the page under audit.
   */
  async tryServeFromCache(route: Route, pageUrl: string): Promise<boolean> {
    const request = route.request();
    const url = request.url();

    if (
      request.method() !== 'GET' ||
      url === pageUrl ||
      !CACHEABLE_ORIGINS.some((origin) => url.startsWith(origin)) ||
      !CACHEABLE_EXTENSIONS.test(url)
    ) {
      return false;
    }

    let pending = this.assetCache.get(url);

    if (!pending) {
      if (this.assetCache.size >= MAX_CACHED_ASSETS) {
        return false;
      }

      pending = this.fetchAsset(route);
      this.assetCache.set(url, pending);
    }

    try {
      await route.fulfill(await pending);

      return true;
    } catch {
      this.assetCache.delete(url);

      return false;
    }
  }

  private async fetchAsset(route: Route): Promise<CachedAsset> {
    const response = await route.fetch();
    const status = response.status();

    if (status !== 200) {
      throw new Error(`Asset responded with ${status}`);
    }

    return { status, headers: response.headers(), body: await response.body() };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
    }

    this.assetCache.clear();
  }
}
