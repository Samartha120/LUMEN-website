import { calculateHaversineDistanceMeters } from '../src/utils/geo';
import { calculatePriorityScore } from '../src/utils/priority';
import { FieldToolkitService } from '../src/services/fieldToolkit.service';
import { RouteService } from '../src/services/route.service';
import { VoiceService } from '../src/services/voice.service';
import { TrackingService } from '../src/services/tracking.service';
import { EmergencyService } from '../src/services/emergency.service';
import { StorageService } from '../src/services/storage.service';

describe('Comprehensive Mobile Architecture Verification Suite', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('safe routing engine multi-mode preference options', async () => {
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const destination = { latitude: 12.9780, longitude: 77.6400 };

    const walkingRoutes = await RouteService.calculateSafeRoutes({
      origin,
      destination,
      preference: 'SAFEST_WELL_LIT',
      travelMode: 'WALKING',
      avoidWaterloggedZones: true,
      avoidUnlitStreets: true,
    });

    const drivingRoutes = await RouteService.calculateSafeRoutes({
      origin,
      destination,
      preference: 'FASTEST',
      travelMode: 'DRIVING',
      avoidWaterloggedZones: false,
      avoidUnlitStreets: false,
    });

    expect(walkingRoutes[0].estimatedMinutes).toBeGreaterThan(drivingRoutes[0].estimatedMinutes);
    expect(walkingRoutes[0].overallSafetyScore).toBeGreaterThanOrEqual(85);
  });

  test('field toolkit civil engineering formulas', () => {
    const calc = FieldToolkitService.calculateRepairMaterials({
      lengthMeters: 4.0,
      widthMeters: 2.5,
      depthCentimeters: 15,
      roadType: 'ARTERIAL_HEAVY_TRAFFIC',
      subBaseCondition: 'SUBSIDED',
    });

    expect(calc.surfaceAreaSqm).toBe(10.0);
    expect(calc.excavationVolumeCubicMeters).toBe(1.5);
    expect(calc.asphaltTonnageRequired).toBeGreaterThan(4.0);
    expect(calc.aggregateTonnageRequired).toBeGreaterThan(3.0);
    expect(calc.recommendedCuringHours).toBe(6);
  });

  test('voice reporting keyword extraction and confidence bounds', () => {
    const report = VoiceService.parseSpeechTranscript(
      'Urgent! Broken streetlight and dark corridor near Indiranagar Metro Station.'
    );
    expect(report.inferredCategory).toBe('electrical');
    expect(report.inferredDamageClass).toBe('broken_streetlight');
    expect(report.confidenceScore).toBeGreaterThan(0.7);
    expect(report.confidenceScore).toBeLessThanOrEqual(1.0);
  });

  test('emergency hazard distance sorting with haversine logic', async () => {
    const userPos = { latitude: 12.9716, longitude: 77.5946 };
    const hazards = await EmergencyService.getActiveHazards(userPos);
    expect(hazards.length).toBeGreaterThan(0);
    for (let i = 0; i < hazards.length - 1; i++) {
      expect(hazards[i].distanceMeters!).toBeLessThanOrEqual(hazards[i + 1].distanceMeters!);
    }
  });

  test('tracking service SLA milestone progression completeness', async () => {
    const tracking = await TrackingService.getTracking('cmp-001');
    expect(tracking).toBeDefined();
    const completedStages = tracking?.milestones.filter(m => m.completed);
    const activeStage = tracking?.milestones.find(m => m.active);
    expect(completedStages?.length).toBeGreaterThan(0);
    expect(activeStage).toBeDefined();
  });
});
