import { EmergencyService } from '../src/services/emergency.service';
import { StorageService } from '../src/services/storage.service';

describe('EmergencyService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('retrieves active hazard broadcasts sorted by distance', async () => {
    const userCoord = { latitude: 12.9716, longitude: 77.5946 };
    const hazards = await EmergencyService.getActiveHazards(userCoord);

    expect(hazards.length).toBeGreaterThan(0);
    expect(hazards[0].distanceMeters).toBeDefined();
    for (let i = 0; i < hazards.length - 1; i++) {
      expect(hazards[i].distanceMeters!).toBeLessThanOrEqual(hazards[i + 1].distanceMeters!);
    }
  });

  test('acknowledges a hazard broadcast', async () => {
    const hazards = await EmergencyService.getActiveHazards();
    const target = hazards[0];
    const initialAcks = target.acknowledgedCount;

    await EmergencyService.acknowledgeHazard(target.id);

    const updatedHazards = await EmergencyService.getActiveHazards();
    const updated = updatedHazards.find(h => h.id === target.id);
    expect(updated?.hasUserAcknowledged).toBe(true);
    expect(updated?.acknowledgedCount).toBe(initialAcks + 1);
  });

  test('manages geofence subscriptions', async () => {
    const initialSubs = await EmergencyService.getGeofenceSubscriptions();
    expect(initialSubs.length).toBeGreaterThan(0);

    const newSub = {
      id: 'test-geo-1',
      label: 'Campus Zone',
      center: { latitude: 12.9300, longitude: 77.6000 },
      radiusMeters: 1000,
      categories: ['roads' as const, 'electrical' as const],
      minimumSeverity: 'WARNING' as const,
      pushEnabled: true,
    };

    const saved = await EmergencyService.saveGeofenceSubscription(newSub);
    expect(saved.some(s => s.id === 'test-geo-1')).toBe(true);
  });
});
