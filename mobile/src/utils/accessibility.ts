/**
 * Accessibility helpers for screen readers, high contrast, and dynamic scaling.
 */

import { PriorityLevel, ComplaintStatus, CivicCategory } from '../types/civic.types';
import { formatCategoryName, formatDamageClassName, formatStatusName } from './string';

/**
 * Generate comprehensive screen-reader accessible label for a civic complaint
 */
export function getComplaintAccessibilityLabel(complaint: {
  ticketNumber: string;
  category: CivicCategory;
  damageClass: string;
  priority: PriorityLevel;
  status: ComplaintStatus;
  address?: string;
}): string {
  const categoryStr = formatCategoryName(complaint.category);
  const classStr = formatDamageClassName(complaint.damageClass);
  const statusStr = formatStatusName(complaint.status);
  const locationStr = complaint.address ? ` at ${complaint.address}` : '';

  return `Ticket ${complaint.ticketNumber}: ${classStr} under ${categoryStr}. Priority ${complaint.priority}. Current status: ${statusStr}${locationStr}. Double tap to view full tracking and audit details.`;
}

/**
 * Calculate WCAG relative luminance and contrast ratio
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
    const b = parseInt(cleanHex.substr(4, 2), 16) / 255;

    const transform = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
  };

  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}
