import { Injectable } from '@angular/core';
import type { AccessibilityTestResponse } from '@dua-upd/types-common';

@Injectable({
  providedIn: 'root'
})
export class PageTestsCacheService {
  private accessibilityCache = new Map<string, AccessibilityTestResponse>();

  // Accessibility cache methods
  getAccessibilityCache(url: string): AccessibilityTestResponse | undefined {
    return this.accessibilityCache.get(url);
  }

  setAccessibilityCache(url: string, data: AccessibilityTestResponse): void {
    this.accessibilityCache.set(url, data);
  }

  clearAccessibilityCache(): void {
    this.accessibilityCache.clear();
  }

  // Clear all caches
  clearAllCaches(): void {
    this.accessibilityCache.clear();
  }
}