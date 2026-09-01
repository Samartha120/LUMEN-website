import { TrackingService } from '../src/services/tracking.service';
import { StorageService } from '../src/services/storage.service';

describe('TrackingService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('fetches live complaint tracking with milestones', async () => {
    const tracking = await TrackingService.getTracking('cmp-001');
    expect(tracking).toBeDefined();
    expect(tracking?.complaintId).toBe('cmp-001');
    expect(tracking?.milestones.length).toBeGreaterThan(0);
    expect(tracking?.incidentLocation).toBeDefined();
  });

  test('submits an escalation request', async () => {
    const res = await TrackingService.requestEscalation({
      complaintId: 'cmp-001',
      reason: 'SLA_BREACH',
      note: 'Repair has stalled for over 48 hours.',
      urgencyBoost: true,
      timestamp: new Date().toISOString(),
    });

    expect(res.success).toBe(true);

    const updated = await TrackingService.getTracking('cmp-001');
    expect(updated?.escalationCount).toBe(1);
    expect(updated?.canEscalate).toBe(false);
  });

  test('updates stage of milestone progression', async () => {
    const updated = await TrackingService.updateStage('cmp-001', 'QUALITY_INSPECTION');
    expect(updated.currentStage).toBe('QUALITY_INSPECTION');

    const inspectMilestone = updated.milestones.find(m => m.stage === 'QUALITY_INSPECTION');
    expect(inspectMilestone?.active).toBe(true);
  });
});
