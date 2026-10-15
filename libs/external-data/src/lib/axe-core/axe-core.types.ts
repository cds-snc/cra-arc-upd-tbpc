import type {
  AccessibilityConformanceLevel,
  AccessibilityImpact,
} from '@dua-upd/types-common';

export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'best-practice',
] as const;

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

export const OPT_IN_RULES = ['target-size', ...AAA_RULES] as const;

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
