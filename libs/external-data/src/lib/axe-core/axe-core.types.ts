import type { Result, NodeResult } from 'axe-core';

/**
 * Internal types for handling axe-core results
 */

// Re-export axe-core types for convenience
export type AxeResult = Result;
export type AxeNodeResult = NodeResult;

// Raw results from axe-core analysis
export type AxeAnalysisResults = {
  violations: Result[];
  passes: Result[];
  incomplete: Result[];
  inapplicable: Result[];
};

// Impact severity levels from axe-core
export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

// WCAG tags that we want to run
export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'best-practice',
] as const;

// Impact weights for score calculation
export const IMPACT_WEIGHTS: Record<ImpactLevel, number> = {
  critical: 10,
  serious: 5,
  moderate: 3,
  minor: 1,
};
