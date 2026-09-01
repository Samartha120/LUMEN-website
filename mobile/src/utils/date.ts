/**
 * Date & Time formatting and SLA countdown utilities.
 */

/**
 * Format timestamp as friendly relative time (e.g. "5m ago", "2h ago", "yesterday")
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return 'Recently';

    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 86400 * 2) return 'Yesterday';
    if (diffSeconds < 86400 * 7) return `${Math.floor(diffSeconds / 86400)}d ago`;

    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: new Date().getFullYear() !== new Date(isoString).getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Recently';
  }
}

/**
 * Calculate SLA remaining countdown or overdue duration
 */
export function formatSLACountdown(deadlineIso: string): {
  formattedText: string;
  isOverdue: boolean;
  totalMinutesRemaining: number;
  urgencyLevel: 'SAFE' | 'WARNING' | 'CRITICAL_BREACH';
} {
  try {
    const deadlineTime = new Date(deadlineIso).getTime();
    const now = Date.now();
    const diffMs = deadlineTime - now;
    const isOverdue = diffMs < 0;
    const absDiffMinutes = Math.abs(Math.floor(diffMs / (1000 * 60)));

    const hours = Math.floor(absDiffMinutes / 60);
    const minutes = absDiffMinutes % 60;

    let formattedText = '';
    if (isOverdue) {
      formattedText = `Overdue by ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
    } else {
      formattedText = `${hours > 0 ? `${hours}h ` : ''}${minutes}m left`;
    }

    let urgencyLevel: 'SAFE' | 'WARNING' | 'CRITICAL_BREACH' = 'SAFE';
    if (isOverdue) {
      urgencyLevel = 'CRITICAL_BREACH';
    } else if (absDiffMinutes < 120) {
      urgencyLevel = 'WARNING';
    }

    return {
      formattedText,
      isOverdue,
      totalMinutesRemaining: Math.floor(diffMs / (1000 * 60)),
      urgencyLevel,
    };
  } catch {
    return {
      formattedText: 'SLA Active',
      isOverdue: false,
      totalMinutesRemaining: 1440,
      urgencyLevel: 'SAFE',
    };
  }
}

/**
 * Format exact human readable date and time
 */
export function formatFullDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return `${d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return isoString;
  }
}
