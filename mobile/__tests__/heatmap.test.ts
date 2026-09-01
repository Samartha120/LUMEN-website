import { HeatmapService } from '../src/services/heatmap.service';

describe('HeatmapService Tests', () => {
  test('fetches density points', async () => {
    const points = await HeatmapService.getHeatmapPoints();
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toHaveProperty('coordinate');
    expect(points[0]).toHaveProperty('weight');
    expect(points[0]).toHaveProperty('category');
  });

  test('filters points by categories', async () => {
    const electricalPoints = await HeatmapService.getHeatmapPoints({ categories: ['electrical'] });
    electricalPoints.forEach(p => {
      expect(p.category).toBe('electrical');
    });
  });

  test('calculates haversine distance between two coordinates', () => {
    const coord1 = { latitude: 12.9716, longitude: 77.5946 };
    const coord2 = { latitude: 12.9716, longitude: 77.5946 };
    const distanceZero = HeatmapService.calculateDistance(coord1, coord2);
    expect(distanceZero).toBe(0);

    const coordFar = { latitude: 12.9800, longitude: 77.6400 };
    const dist = HeatmapService.calculateDistance(coord1, coordFar);
    expect(dist).toBeGreaterThan(1000);
  });

  test('retrieves ward safety rankings sorted by safety score', async () => {
    const wards = await HeatmapService.getWardSafetyScores();
    expect(wards.length).toBeGreaterThan(0);
    for (let i = 0; i < wards.length - 1; i++) {
      expect(wards[i].safetyScore).toBeGreaterThanOrEqual(wards[i + 1].safetyScore);
    }
  });

  test('retrieves incident clusters with polygon vertices', async () => {
    const clusters = await HeatmapService.getIncidentClusters();
    expect(clusters.length).toBeGreaterThan(0);
    clusters.forEach(c => {
      expect(c.boundingPolygon.length).toBeGreaterThanOrEqual(3);
      expect(c.pointCount).toBeGreaterThan(0);
    });
  });
});
