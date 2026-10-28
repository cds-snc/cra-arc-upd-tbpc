import type {
  AccessibilityConformanceLevel,
  AccessibilityImpact,
  AccessibilityViewport,
} from '@dua-upd/types-common';

export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'best-practice',
] as const;

export type { AccessibilityViewport };

export const AUDIT_VIEWPORTS: readonly AccessibilityViewport[] = [
  'desktop',
  'mobile',
];

export const EXCLUDED_SELECTORS = [
  '.global-header nav',
  '#wb-tphp',
  '.gcweb-menu',
  '#wb-bc',
  '.gc-contextual nav',
  '.gc-main-footer nav',
  '.gc-sub-footer nav',
  'header nav',
  'footer nav',
  'iframe',
] as const;

export const AAA_RULES = [
  'color-contrast-enhanced',
  'identical-links-same-purpose',
  'meta-refresh-no-exceptions',
] as const;

/**
 * axe ships these disabled and still in development, so they may produce false
 * positives. Enabled for the reference-only tab and excluded from scoring.
 */
export const EXPERIMENTAL_RULES = [
  'css-orientation-lock',
  'focus-order-semantics',
  'hidden-content',
  'label-content-name-mismatch',
  'p-as-heading',
  'table-fake-caption',
  'td-has-header',
] as const;

export const OPT_IN_RULES = [
  'target-size',
  ...AAA_RULES,
  ...EXPERIMENTAL_RULES,
] as const;

export const OPT_IN_RULE_OPTIONS: Record<string, { enabled: boolean }> =
  Object.fromEntries(OPT_IN_RULES.map((id) => [id, { enabled: true }]));

export const STORED_HTML_DISABLED_RULES: Record<string, { enabled: boolean }> = {
  'document-title': { enabled: false },
};

export const CONFORMANCE_LEVEL_TAGS: readonly (readonly [
  AccessibilityConformanceLevel,
  readonly string[],
])[] = [
  ['AAA', ['wcag2aaa', 'wcag21aaa', 'wcag22aaa']],
  ['AA', ['wcag2aa', 'wcag21aa', 'wcag22aa']],
  ['A', ['wcag2a', 'wcag21a', 'wcag22a']],
  ['best-practice', ['best-practice']],
];

export const UNSCORED_LEVELS: readonly AccessibilityConformanceLevel[] = ['AAA'];

/**
 * Criteria added in WCAG 2.2. They run and are reported, but are excluded from the
 * score and the conformance verdict, which gate on WCAG 2.1 AA.
 *
 * Matched exactly, never by prefix: axe also tags criterion numbers, so `wcag221`,
 * `wcag222` and `wcag224` are SC 2.2.1/2.2.2/2.2.4 of WCAG 2.0 — not WCAG 2.2. Of the
 * 105 rules axe ships, only `target-size` (SC 2.5.8) carries a real 2.2 level tag; the
 * other five 2.2 A/AA criteria have no automated test and sit in MANUAL_CRITERIA.
 */
export const WCAG22_LEVEL_TAGS: readonly string[] = ['wcag22a', 'wcag22aa'];

/**
 * Node detail is only actionable where a person has to do something, so it is kept
 * for failures and manual checks and dropped for passes and non-applicable results.
 * Without this a single response reached 4.7 MB, 14,858 of its 18,330 nodes being
 * `hidden-content` passes.
 */
export const NODE_DETAIL_CATEGORIES: readonly string[] = [
  'failed',
  'manual_check',
];

export const MAX_AUDIT_NODES = 25;

/**
 * WET-BOEW builds most of canada.ca's accessibility markup *after* the load event, and
 * is not finished when `load` fires. Measured on the CRA home page, the DOM goes from
 * 502 to 1,194 elements and ARIA attributes from 43 to 699 in the seconds afterwards.
 * A fixed delay therefore audited a half-enhanced page and moved rules between
 * `passed` and `not_applicable` from one run to the next; waiting on WET-BOEW's own
 * readiness flag gave identical results across every run of a 12-run comparison.
 *
 * Bounded because a page that never loads WET-BOEW has no `wb` object to wait for.
 */
export const WET_BOEW_READY_TIMEOUT_MS = 20_000;

export const IMPACT_WEIGHTS: Record<AccessibilityImpact, number> = {
  critical: 10,
  serious: 5,
  moderate: 3,
  minor: 1,
};

export type StoredHtmlSnapshot = {
  html: string;
  title?: string;
  lang?: 'en' | 'fr';
};

export type AxeAuditSource =
  | { kind: 'url'; url: string }
  | ({ kind: 'html'; url: string } & StoredHtmlSnapshot);
