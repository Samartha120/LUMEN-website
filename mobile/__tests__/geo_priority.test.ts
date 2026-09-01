import {
  calculateHaversineDistanceMeters,
  formatDistance,
  isPointInsidePolygon,
  getBoundingBox,
  formatCoordinate,
} from '../src/utils/geo';
import { calculatePriorityScore, getCategorySLAHours } from '../src/utils/priority';
import { formatRelativeTime, formatSLACountdown } from '../src/utils/date';
import { formatCategoryName, formatDamageClassName, truncate } from '../src/utils/string';
import { clamp, mean, median, normalizeDistribution, movingAverage } from '../src/utils/math';
import { DataExportUtil } from '../src/utils/export';

describe('Geo and Priority Utilities Tests', () => {
  test('geo distance and format calculation', () => {
    const c1 = { latitude: 12.9716, longitude: 77.5946 };
    const c2 = { latitude: 12.9780, longitude: 77.6400 };

    const dist = calculateHaversineDistanceMeters(c1, c2);
    expect(dist).toBeGreaterThan(4000);
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(4500)).toBe('4.5 km');
  });

  test('polygon point containment', () => {
    const poly = [
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 0 },
      { latitude: 10, longitude: 10 },
      { latitude: 0, longitude: 10 },
    ];
    const inside = { latitude: 5, longitude: 5 };
    const outside = { latitude: 15, longitude: 15 };

    expect(isPointInsidePolygon(inside, poly)).toBe(true);
    expect(isPointInsidePolygon(outside, poly)).toBe(false);
  });

  test('bounding box calculation', () => {
    const center = { latitude: 12.9716, longitude: 77.5946 };
    const box = getBoundingBox(center, 1000);

    expect(box.minLat).toBeLessThan(center.latitude);
    expect(box.maxLat).toBeGreaterThan(center.latitude);
    expect(box.minLng).toBeLessThan(center.longitude);
    expect(box.maxLng).toBeGreaterThan(center.longitude);
  });

  test('coordinate string formatters', () => {
    const coord = { latitude: 12.9716, longitude: 77.5946 };
    const dec = formatCoordinate(coord, 'DECIMAL');
    expect(dec).toContain('12.97160° N');
  });

  test('priority score algorithm calculation', () => {
    const criticalCalc = calculatePriorityScore({
      damageClass: 'exposed_wire',
      aiConfidence: 0.95,
      isNearSensitiveZone: true,
      nearbyComplaintsCount: 3,
    });
    expect(criticalCalc.score).toBeGreaterThanOrEqual(90);
    expect(criticalCalc.priorityLevel).toBe('EMERGENCY');

    const lowCalc = calculatePriorityScore({
      damageClass: 'damaged_signage',
      aiConfidence: 0.8,
      isNearSensitiveZone: false,
    });
    expect(lowCalc.priorityLevel).toBe('LOW');
  });

  test('SLA hours determination', () => {
    expect(getCategorySLAHours('electrical')).toBe(12);
    expect(getCategorySLAHours('water')).toBe(24);
    expect(getCategorySLAHours('roads')).toBe(48);
    expect(getCategorySLAHours('roads', 'EMERGENCY')).toBe(12);
  });

  test('date formatters and SLA countdowns', () => {
    const nowIso = new Date().toISOString();
    expect(formatRelativeTime(nowIso)).toBe('Just now');

    const futureDeadline = new Date(Date.now() + 3600 * 1000 * 5).toISOString();
    const countdown = formatSLACountdown(futureDeadline);
    expect(countdown.isOverdue).toBe(false);
    expect(countdown.urgencyLevel).toBe('SAFE');

    const pastDeadline = new Date(Date.now() - 3600 * 1000 * 2).toISOString();
    const overdueCountdown = formatSLACountdown(pastDeadline);
    expect(overdueCountdown.isOverdue).toBe(true);
    expect(overdueCountdown.urgencyLevel).toBe('CRITICAL_BREACH');
  });

  test('string taxonomy formatting', () => {
    expect(formatCategoryName('roads')).toBe('Roads & Infrastructure');
    expect(formatCategoryName('electrical')).toBe('Electricity & Power');
    expect(formatDamageClassName('open_manhole')).toBe('Open Manhole');
    expect(truncate('Super long text description', 10)).toBe('Super l...');
  });

  test('math helpers', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(mean([10, 20, 30])).toBe(20);
    expect(median([1, 5, 2])).toBe(2);

    const dist = normalizeDistribution([2, 2]);
    expect(dist[0]).toBe(0.5);

    const mAvg = movingAverage([10, 20, 30, 40]);
    expect(mAvg.length).toBe(4);
  });

  test('data export CSV and GeoJSON', () => {
    const sampleComplaints: any[] = [
      {
        id: 'c1',
        ticketNumber: 'LMN-101',
        category: 'roads',
        damageClass: 'pothole',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        priorityScore: 78,
        location: {
          address: '100ft Road, Indiranagar',
          coordinate: { latitude: 12.9716, longitude: 77.5946 },
          ward: 'Ward 112',
        },
        assignedDepartment: 'Roads & Infrastructure',
        upvoteCount: 12,
        createdAt: new Date().toISOString(),
      },
    ];

    const csv = DataExportUtil.complaintsToCSV(sampleComplaints);
    expect(csv).toContain('Ticket Number');
    expect(csv).toContain('LMN-101');

    const geojson = DataExportUtil.complaintsToGeoJSON(sampleComplaints);
    const parsed = JSON.parse(geojson);
    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features.length).toBe(1);
    expect(parsed.features[0].geometry.coordinates[0]).toBe(77.5946);
  });
});
