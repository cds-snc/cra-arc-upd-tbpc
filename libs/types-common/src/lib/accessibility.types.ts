export type LocalizedAccessibilityTestResponse = {
  en?: AccessibilityTestResponse;
  fr?: AccessibilityTestResponse;
};

export type AccessibilityTestResponse = {
  success: boolean;
  data?: {
    desktop: AccessibilityTestResult;
    mobile: AccessibilityTestResult;
  };
  error?: string;
};

export type AccessibilityTestResult = {
  url: string;
  strategy: 'mobile' | 'desktop';
  score: number;
  scoreDisplay: string;
  audits: AccessibilityAudit[];
  testedAt: Date;
};

// Raw check result data for translation support
export type AccessibilityCheckResult = {
  id: string;                     // Check ID (e.g., 'aria-valid-attr-value')
  data?: unknown;                 // Dynamic data for template rendering
  checkType: 'any' | 'all' | 'none';  // Which array this check came from
};

// New type for affected element details (axe-core nodes)
export type AccessibilityAuditNode = {
  html: string;                    // HTML snippet
  target: string[];               // CSS selector path (handles iframes)
  failureSummary?: string;        // Why this specific element failed (pre-rendered)
  checkResults?: AccessibilityCheckResult[];  // Raw check data for translation
};

export type AccessibilityAudit = {
  // Existing fields (kept for backward compatibility)
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayMode: string;
  category: 'failed' | 'manual_check' | 'passed' | 'not_applicable';
  snippet?: string;               // Keep for backward compat (first element)
  helpText?: string;
  selector?: string;              // Keep for backward compat (first element)
  impact?: 'critical' | 'serious' | 'moderate' | 'minor';
  tags?: string[];
  helpUrl?: string;

  // New fields for enhanced reporting (axe-core)
  nodes?: AccessibilityAuditNode[];   // All affected elements
  wcagCriteria?: string[];            // Extracted WCAG criteria (e.g., ['1.4.3', '1.4.11'])
  howToFix?: string;                  // Structured fix guidance
  affectedCount?: number;             // Count of affected elements
};
