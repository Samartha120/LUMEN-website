/**
 * Offline sync, cached queues, and storage telemetry types.
 */

export type OutboxItemType = 'COMPLAINT_SUBMISSION' | 'COMMENT_POST' | 'UPVOTE_TOGGLE' | 'VERIFICATION_SUBMISSION' | 'STATUS_UPDATE';

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED_RETRYABLE' | 'FAILED_FATAL';

export interface OutboxItem<T = any> {
  id: string;
  type: OutboxItemType;
  payload: T;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  lastErrorMessage?: string;
  status: OutboxStatus;
  mediaFileUris?: string[];
}

export interface SyncTelemetry {
  totalPending: number;
  totalSynced: number;
  totalFailed: number;
  isOnline: boolean;
  lastSyncTimestamp?: string;
  networkConnectionType: string;
  isMeteredConnection: boolean;
}

export interface CachedDataEntry<T> {
  key: string;
  data: T;
  savedAt: number;
  ttlMillis: number;
  version: number;
}
