import { FloodService } from '../src/services/flood.service';
import { StorageService } from '../src/services/storage.service';

describe('FloodService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('retrieves live stormwater sensors telemetry', async () => {
    const sensors = await FloodService.getSensors();
    expect(sensors.length).toBeGreaterThan(0);
    sensors.forEach(s => {
      expect(s.sensorId).toBeDefined();
      expect(s.currentDepthMeters).toBeGreaterThanOrEqual(0);
      expect(s.capacityUtilizationPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  test('retrieves flood alert perimeters with safe shelters', async () => {
    const perimeters = await FloodService.getFloodPerimeters();
    expect(perimeters.length).toBeGreaterThan(0);
    expect(perimeters[0].safeShelters.length).toBeGreaterThan(0);
    expect(perimeters[0].affectedStreets.length).toBeGreaterThan(0);
  });
});
