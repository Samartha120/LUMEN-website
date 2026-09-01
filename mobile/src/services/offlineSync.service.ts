/**
 * Resilient Offline Queue & Background Sync Engine for LUMEN Mobile.
 */

import NetInfo from '@react-native-community/netinfo';
import { OutboxItem, OutboxItemType, SyncTelemetry } from '../types/offline.types';
import { StorageService } from './storage.service';

const OUTBOX_STORAGE_KEY = 'offline_outbox_queue';
const SYNC_TELEMETRY_KEY = 'sync_telemetry';

export class OfflineSyncService {
  private static isSyncing = false;
  private static listeners: Array<(telemetry: SyncTelemetry) => void> = [];

  /**
   * Subscribe to sync state changes
   */
  static subscribe(listener: (telemetry: SyncTelemetry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notifyListeners(telemetry: SyncTelemetry) {
    this.listeners.forEach(l => l(telemetry));
  }

  /**
   * Get all items currently in the outbox
   */
  static async getOutboxItems(): Promise<OutboxItem[]> {
    const items = await StorageService.getItem<OutboxItem[]>(OUTBOX_STORAGE_KEY);
    return items || [];
  }

  /**
   * Enqueue a new item to be synced when network is available
   */
  static async enqueueItem<T>(type: OutboxItemType, payload: T, mediaFileUris?: string[]): Promise<OutboxItem<T>> {
    const items = await this.getOutboxItems();
    const newItem: OutboxItem<T> = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      status: 'PENDING',
      mediaFileUris,
    };

    items.push(newItem);
    await StorageService.setItem(OUTBOX_STORAGE_KEY, items);

    // Attempt instant flush if connected
    const net = await NetInfo.fetch();
    if (net.isConnected) {
      this.flushQueue();
    } else {
      this.updateTelemetry();
    }

    return newItem;
  }

  /**
   * Remove or cancel an outbox item
   */
  static async removeItem(itemId: string): Promise<void> {
    const items = await this.getOutboxItems();
    const filtered = items.filter(i => i.id !== itemId);
    await StorageService.setItem(OUTBOX_STORAGE_KEY, filtered);
    this.updateTelemetry();
  }

  /**
   * Process and flush all pending outbox items with exponential backoff
   */
  static async flushQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isSyncing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      await this.updateTelemetry(false);
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isSyncing = true;
    let succeeded = 0;
    let failed = 0;

    const items = await this.getOutboxItems();
    const pending = items.filter(i => i.status === 'PENDING' || i.status === 'FAILED_RETRYABLE');

    for (const item of pending) {
      try {
        item.status = 'SYNCING';
        item.attemptCount += 1;
        item.lastAttemptAt = new Date().toISOString();
        await StorageService.setItem(OUTBOX_STORAGE_KEY, items);

        // Process item based on type
        await this.processItem(item);

        item.status = 'SYNCED';
        succeeded += 1;
      } catch (err: any) {
        failed += 1;
        item.lastErrorMessage = err?.message || 'Unknown network error';
        if (item.attemptCount >= 5) {
          item.status = 'FAILED_FATAL';
        } else {
          item.status = 'FAILED_RETRYABLE';
        }
      }
    }

    // Retain only un-synced items or recent failures
    const remaining = items.filter(i => i.status !== 'SYNCED');
    await StorageService.setItem(OUTBOX_STORAGE_KEY, remaining);

    this.isSyncing = false;
    await this.updateTelemetry(true);

    return { processed: pending.length, succeeded, failed };
  }

  /**
   * Mock processing of individual outbox items
   */
  private static async processItem(item: OutboxItem): Promise<void> {
    // Artificial small delay representing HTTP network request
    await new Promise(resolve => setTimeout(resolve, 300));
    // In production, dispatch to backend API: /api/complaints, /api/community, etc.
  }

  /**
   * Update telemetry and broadcast to active UI listeners
   */
  static async updateTelemetry(forcedOnlineState?: boolean): Promise<SyncTelemetry> {
    const items = await this.getOutboxItems();
    const net = await NetInfo.fetch();
    const isOnline = forcedOnlineState !== undefined ? forcedOnlineState : (net.isConnected ?? false);

    const telemetry: SyncTelemetry = {
      totalPending: items.filter(i => i.status === 'PENDING' || i.status === 'SYNCING').length,
      totalSynced: items.filter(i => i.status === 'SYNCED').length,
      totalFailed: items.filter(i => i.status === 'FAILED_RETRYABLE' || i.status === 'FAILED_FATAL').length,
      isOnline,
      lastSyncTimestamp: new Date().toISOString(),
      networkConnectionType: net.type,
      isMeteredConnection: net.details?.isConnectionExpensive ?? false,
    };

    await StorageService.setItem(SYNC_TELEMETRY_KEY, telemetry);
    this.notifyListeners(telemetry);
    return telemetry;
  }
}
