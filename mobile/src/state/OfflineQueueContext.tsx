import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OutboxItem, OutboxItemType, SyncTelemetry } from '../types/offline.types';
import { OfflineSyncService } from '../services/offlineSync.service';
import { HapticFeedback } from '../utils/haptics';

interface OfflineQueueContextType {
  outbox: OutboxItem[];
  telemetry: SyncTelemetry;
  isSyncing: boolean;
  enqueueAction: <T>(type: OutboxItemType, payload: T, mediaFileUris?: string[]) => Promise<OutboxItem<T>>;
  removeOutboxItem: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const initialTelemetry: SyncTelemetry = {
  totalPending: 0,
  totalSynced: 0,
  totalFailed: 0,
  isOnline: true,
  networkConnectionType: 'wifi',
  isMeteredConnection: false,
};

const OfflineQueueContext = createContext<OfflineQueueContextType | null>(null);

export const OfflineQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [telemetry, setTelemetry] = useState<SyncTelemetry>(initialTelemetry);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueue = useCallback(async () => {
    const items = await OfflineSyncService.getOutboxItems();
    setOutbox(items);
    const telem = await OfflineSyncService.updateTelemetry();
    setTelemetry(telem);
  }, []);

  useEffect(() => {
    refreshQueue();
    const unsubscribe = OfflineSyncService.subscribe(newTelemetry => {
      setTelemetry(newTelemetry);
      OfflineSyncService.getOutboxItems().then(setOutbox);
    });
    return () => unsubscribe();
  }, [refreshQueue]);

  const enqueueAction = async <T,>(type: OutboxItemType, payload: T, mediaFileUris?: string[]) => {
    HapticFeedback.light();
    const item = await OfflineSyncService.enqueueItem(type, payload, mediaFileUris);
    await refreshQueue();
    return item;
  };

  const removeOutboxItem = async (id: string) => {
    await OfflineSyncService.removeItem(id);
    await refreshQueue();
  };

  const syncNow = async () => {
    setIsSyncing(true);
    HapticFeedback.medium();
    try {
      await OfflineSyncService.flushQueue();
      await refreshQueue();
      HapticFeedback.success();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <OfflineQueueContext.Provider
      value={{
        outbox,
        telemetry,
        isSyncing,
        enqueueAction,
        removeOutboxItem,
        syncNow,
      }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
};

export const useOfflineQueue = () => {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  }
  return context;
};
