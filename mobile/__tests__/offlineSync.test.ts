import { OfflineSyncService } from '../src/services/offlineSync.service';
import { StorageService } from '../src/services/storage.service';

describe('OfflineSyncService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('enqueues an outbox item when offline', async () => {
    const item = await OfflineSyncService.enqueueItem('COMPLAINT_SUBMISSION', {
      title: 'Pothole on Main Road',
      category: 'roads',
    });

    expect(item.id).toBeDefined();
    expect(item.type).toBe('COMPLAINT_SUBMISSION');

    const outbox = await OfflineSyncService.getOutboxItems();
    expect(outbox.some(i => i.id === item.id)).toBe(true);
  });

  test('removes an outbox item', async () => {
    const item = await OfflineSyncService.enqueueItem('UPVOTE_TOGGLE', { postId: 'post-101' });
    await OfflineSyncService.removeItem(item.id);

    const outbox = await OfflineSyncService.getOutboxItems();
    expect(outbox.some(i => i.id === item.id)).toBe(false);
  });

  test('updates and emits telemetry stats', async () => {
    const telemetry = await OfflineSyncService.updateTelemetry(true);
    expect(telemetry.isOnline).toBe(true);
    expect(telemetry.totalPending).toBeGreaterThanOrEqual(0);
  });
});
