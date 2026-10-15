const langRegex = /canada\.ca\/(en|fr)/i;

const documentRegex = /<html[\s>]/i;

const mainRegex = /<main[\s>]/i;

export const CANADA_CA_BASE_URL = 'https://www.canada.ca/';

/**
 * The WET-BOEW bundle every canada.ca page loads. Analytics and RUM scripts are
 * deliberately excluded: they have no accessibility effect and shouldn't be fired
 * from an audit. Stored snapshots have no scripts at all (see rebuildDocument),
 * so without these the audited DOM is roughly a third of the real page.
 */
export const WET_BOEW_SCRIPTS = [
  'https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js',
  `${CANADA_CA_BASE_URL}etc/designs/canada/wet-boew/js/wet-boew.min.js`,
  `${CANADA_CA_BASE_URL}etc/designs/canada/wet-boew/js/theme.min.js`,
] as const;

export const WET_BOEW_STYLESHEETS = [
  `${CANADA_CA_BASE_URL}etc/designs/canada/wet-boew/css/theme.min.css`,
] as const;

const allowedHostnames = ['canada.ca'];

/**
 * Auditing a live page would otherwise run canada.ca's full analytics stack from our
 * own infrastructure, registering page views in the very data UPD reports on. Adobe
 * Target also sits behind DTM and can swap content, so blocking these keeps audits
 * deterministic as well as keeping the numbers clean.
 */
const blockedAnalyticsDomains = [
  'adobedtm.com',
  'omtrdc.net',
  'demdex.net',
  'everesttech.net',
  'go-mpulse.net',
  '2o7.net',
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
];

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const getUrlLang = (url: string): 'en' | 'fr' =>
  (langRegex.exec(url)?.[1]?.toLowerCase() as 'en' | 'fr') || 'en';

export const isAnalyticsRequest = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();

    return blockedAnalyticsDomains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
};

export const assertAuditableUrl = (url: string): void => {
  const { protocol, hostname } = new URL(url);

  if (!['http:', 'https:'].includes(protocol)) {
    throw new Error(
      `Unsupported protocol for accessibility testing: ${protocol}`,
    );
  }

  const host = hostname.toLowerCase();

  const isAllowed = allowedHostnames.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );

  if (!isAllowed) {
    throw new Error(
      `Accessibility testing is restricted to canada.ca: ${hostname}`,
    );
  }
};

export const rebuildDocument = (
  html: string,
  lang: 'en' | 'fr',
  {
    withScripts = false,
    title,
  }: { withScripts?: boolean; title?: string } = {},
): string => {
  if (documentRegex.test(html)) {
    return html;
  }

  const scripts = withScripts
    ? WET_BOEW_SCRIPTS.map((src) => `<script src="${src}"></script>`).join('')
    : '';

  const stylesheets = WET_BOEW_STYLESHEETS.map(
    (href) => `<link rel="stylesheet" href="${href}">`,
  ).join('');

  const body = mainRegex.test(html) ? html : `<main>${html}</main>`;

  const titleTag = title ? `<title>${escapeHtml(title)}</title>` : '';

  return `<!doctype html><html lang="${lang}" dir="ltr"><head><base href="${CANADA_CA_BASE_URL}">${titleTag}${stylesheets}</head><body>${body}${scripts}</body></html>`;
};
