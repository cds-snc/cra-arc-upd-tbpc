export type LocalizedAccessibilityTestResponse = {
  en?: AccessibilityTestResponse;
  fr?: AccessibilityTestResponse;
};

export type AccessibilityTestResponse = {
  success: boolean;
  data?: {
    desktop: AccessibilityTestResult;
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

export type AccessibilityAudit = {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayMode: string;
  category: 'failed' | 'manual_check' | 'passed' | 'not_applicable';
  snippet?: string;
  helpText?: string;
  selector?: string;
  impact?: string;
  tags?: string[];
  helpUrl?: string;
};
