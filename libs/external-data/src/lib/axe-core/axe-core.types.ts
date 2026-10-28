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
