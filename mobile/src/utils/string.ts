/**
 * String manipulation, search tokenizer, and taxonomy formatting utilities.
 */

import { CivicCategory, CivicDamageClass, PriorityLevel, ComplaintStatus } from '../types/civic.types';

/**
 * Convert snake_case or SCREAMING_SNAKE to Title Case
 */
export function formatDamageClassName(damageClass: CivicDamageClass | string): string {
  if (!damageClass) return '';
  return damageClass
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format category name with proper capitalisation
 */
export function formatCategoryName(category: CivicCategory | string): string {
  if (!category) return '';
  switch (category) {
    case 'roads':
      return 'Roads & Infrastructure';
    case 'electrical':
      return 'Electricity & Power';
    case 'waste':
      return 'Sanitation & Waste';
    case 'water':
      return 'Water Supply & Drains';
    case 'public_property':
      return 'Public Works & Assets';
    default:
      return formatDamageClassName(category);
  }
}

/**
 * Format complaint status text
 */
export function formatStatusName(status: ComplaintStatus | string): string {
  if (!status) return '';
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'TRIAGED':
      return 'Triaged';
    case 'ASSIGNED':
      return 'Assigned';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'WORK_COMPLETED':
      return 'Work Done';
    case 'VERIFIED':
      return 'AI Verified';
    case 'RESOLVED':
      return 'Resolved';
    case 'REJECTED':
      return 'Rejected';
    case 'ESCALATED':
      return 'Escalated';
    default:
      return formatDamageClassName(status);
  }
}

/**
 * Truncate long text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Tokenize search query for robust multi-word matching
 */
export function tokenizeSearchQuery(query: string): string[] {
  if (!query) return [];
  return query
    .toLowerCase()
    .trim()
    .split(/[\s,+#_.-]+/)
    .filter(token => token.length > 1);
}
