import { RouteService } from '../src/services/route.service';

describe('RouteService Tests', () => {
  test('calculates safe route options with safety scores', async () => {
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const destination = { latitude: 12.9780, longitude: 77.6400 };

    const routes = await RouteService.calculateSafeRoutes({
      origin,
      destination,
      preference: 'SAFEST_WELL_LIT',
      travelMode: 'WALKING',
      avoidWaterloggedZones: true,
      avoidUnlitStreets: true,
    });

    expect(routes.length).toBeGreaterThanOrEqual(3);
    const wellLit = routes.find(r => r.id === 'route-well-lit');
    expect(wellLit).toBeDefined();
    expect(wellLit?.overallSafetyScore).toBeGreaterThanOrEqual(90);
    expect(wellLit?.waypoints.length).toBeGreaterThan(0);
  });
});
