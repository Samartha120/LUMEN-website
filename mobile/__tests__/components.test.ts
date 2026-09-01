import { calculateHaversineDistanceMeters } from '../src/utils/geo';
import { calculatePriorityScore } from '../src/utils/priority';
import { FieldToolkitService } from '../src/services/fieldToolkit.service';
import { RouteService } from '../src/services/route.service';
import { AssetService } from '../src/services/asset.service';
import { BudgetService } from '../src/services/budget.service';
import { FloodService } from '../src/services/flood.service';
import { VolunteerService } from '../src/services/volunteer.service';
import { KarmaService } from '../src/services/karma.service';
import { VoiceService } from '../src/services/voice.service';
import { CommunityService } from '../src/services/community.service';
import { HeatmapService } from '../src/services/heatmap.service';
import { TrackingService } from '../src/services/tracking.service';
import { EmergencyService } from '../src/services/emergency.service';
import { StorageService } from '../src/services/storage.service';

describe('Comprehensive Mobile Architecture Verification Suite', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('volunteer drive capacity calculation and rsvp workflows', async () => {
    const drives = await VolunteerService.getDrives();
    const target = drives[0];
    expect(target.maxParticipants).toBeGreaterThan(0);
    expect(target.tasks.every(t => t.requiredVolunteers > 0)).toBe(true);

    const { hasUserRsvp, newCount } = await VolunteerService.toggleRsvp(target.id);
    expect(hasUserRsvp).toBe(true);
    expect(newCount).toBe(target.currentRsvpCount + 1);

    const { hasUserRsvp: unRsvp } = await VolunteerService.toggleRsvp(target.id);
    expect(unRsvp).toBe(false);
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

  test('municipal asset registry and maintenance history query', async () => {
    const assets = await AssetService.getAllAssets();
    expect(assets.length).toBeGreaterThanOrEqual(3);

    for (const asset of assets) {
      const queried = await AssetService.getAssetByTag(asset.qrCodeTag);
      expect(queried?.id).toBe(asset.id);
      expect(queried?.healthScore).toBeGreaterThanOrEqual(0);
      expect(queried?.healthScore).toBeLessThanOrEqual(100);
    }
  });

  test('ward budget expenditure categorization and transparency score', async () => {
    const budget = await BudgetService.getWardBudget('Ward 112');
    expect(budget.transparencyScore).toBeGreaterThanOrEqual(90);

    let sumCategoryAllocations = 0;
    Object.values(budget.breakdownByCategory).forEach(cat => {
      sumCategoryAllocations += cat.allocatedInr;
      expect(cat.spentInr).toBeLessThanOrEqual(cat.allocatedInr);
      expect(cat.projectCount).toBeGreaterThan(0);
    });

    expect(sumCategoryAllocations).toBe(budget.totalBudgetInr);
  });

  test('flood sensor telemetry and rate of rise status flags', async () => {
    const sensors = await FloodService.getSensors();
    const elevated = sensors.find(s => s.status === 'WARNING');
    expect(elevated).toBeDefined();
    expect(elevated?.rateOfRiseCmPerHour).toBeGreaterThan(10);
    expect(elevated?.pumpStationActive).toBe(true);

    const perimeters = await FloodService.getFloodPerimeters();
    expect(perimeters[0].sensors.length).toBeGreaterThan(0);
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

  test('karma calculation and gamified streak progression', async () => {
    const summary = await KarmaService.getKarmaSummary();
    expect(summary.currentStreakDays).toBeGreaterThan(0);
    expect(summary.longestStreakDays).toBeGreaterThanOrEqual(summary.currentStreakDays);

    const leaderboard = await KarmaService.getLeaderboard();
    expect(leaderboard[0].points).toBeGreaterThan(leaderboard[leaderboard.length - 1].points);
  });

  test('emergency hazard distance sorting with haversine logic', async () => {
    const userPos = { latitude: 12.9716, longitude: 77.5946 };
    const hazards = await EmergencyService.getActiveHazards(userPos);
    expect(hazards.length).toBeGreaterThan(0);
    for (let i = 0; i < hazards.length - 1; i++) {
      expect(hazards[i].distanceMeters!).toBeLessThanOrEqual(hazards[i + 1].distanceMeters!);
    }
  });

  test('community poll percentage normalization', async () => {
    const posts = await CommunityService.getFeedPosts();
    const pollPost = posts.find(p => p.type === 'CIVIC_POLL');
    if (pollPost?.pollData) {
      const sumPercentages = pollPost.pollData.options.reduce((acc, opt) => acc + opt.percentage, 0);
      expect(sumPercentages).toBeGreaterThanOrEqual(99);
      expect(sumPercentages).toBeLessThanOrEqual(101);
    }
  });

  test('heatmap clustering bounding polygons', async () => {
    const clusters = await HeatmapService.getIncidentClusters();
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    clusters.forEach(cluster => {
      expect(cluster.activeTicketNumbers.length).toBeGreaterThan(0);
      expect(cluster.clusterRadiusMeters).toBeGreaterThan(0);
    });
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
