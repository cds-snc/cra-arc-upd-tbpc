export type LocalizedAccessibilityTestResponse = {
  en?: AccessibilityTestResponse;
  fr?: AccessibilityTestResponse;
};

export type AccessibilityViewportResults = {
  desktop: AccessibilityTestResult;
  mobile?: AccessibilityTestResult;
};

export type AccessibilityTestResponse = {
  success: boolean;
  data?: AccessibilityViewportResults;
  error?: string;
};

export type AccessibilityTestResult = {
  url: string;
  viewport: AccessibilityViewport;
  score: number;
  scoreDisplay: string;
  audits: AccessibilityAudit[];
  testedAt: Date;
};

export type AccessibilityViewport = 'desktop' | 'mobile';

export type AccessibilityImpact = 'critical' | 'serious' | 'moderate' | 'minor';

export type AccessibilityConformanceLevel = 'A' | 'AA' | 'AAA' | 'best-practice';

export type AccessibilityCheckResult = {
  id: string;
  data?: unknown;
  checkType: 'any' | 'all' | 'none';
};

export type AccessibilityAuditNode = {
  html: string;
  target: string[];
  failureSummary?: string;
  checkResults?: AccessibilityCheckResult[];
};

export type AccessibilityAudit = {
  id: string;
  title: string;
  description: string;
  category: 'failed' | 'manual_check' | 'passed' | 'not_applicable';
  snippet?: string;
  selector?: string;
  impact?: AccessibilityImpact;
  tags?: string[];
  helpUrl?: string;
  nodes?: AccessibilityAuditNode[];
  conformanceLevel?: AccessibilityConformanceLevel;
  experimental?: boolean;
  wcagCriteria?: string[];
  howToFix?: string;
  affectedCount?: number;
};
