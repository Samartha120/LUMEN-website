import { AnalyticsService } from '../src/services/analytics.service';
import { StorageService } from '../src/services/storage.service';

describe('AnalyticsService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('retrieves ward health metrics scorecard', async () => {
    const metrics = await AnalyticsService.getWardHealthMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0].overallScore).toBeGreaterThan(0);
    expect(metrics[0].historicalHealthScores.length).toBe(12);
  });

  test('retrieves department efficiency reports', async () => {
    const reports = await AnalyticsService.getDepartmentEfficiencyReports();
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0].slaCompliancePercentage).toBeGreaterThan(80);
    expect(reports[0].citizenSatisfactionAverage).toBeGreaterThan(4.0);
  });

  test('calculates predictive hazard forecasts', async () => {
    const roadForecast = await AnalyticsService.getPredictiveForecast('roads');
    expect(roadForecast.expectedWeeklyNewIncidents).toBeGreaterThan(0);
    expect(roadForecast.predictedHighRiskZones.length).toBeGreaterThan(0);
    expect(roadForecast.recommendedResourceAllocation.asphaltRepairCrews).toBeGreaterThan(0);

    const waterForecast = await AnalyticsService.getPredictiveForecast('water');
    expect(waterForecast.recommendedResourceAllocation.drainJettingTeams).toBeGreaterThan(0);
  });

  test('calculates smooth velocity moving average', () => {
    const rawWeekly = [10, 20, 30, 40, 50];
    const smoothed = AnalyticsService.calculateSmoothVelocity(rawWeekly);
    expect(smoothed.length).toBe(5);
    expect(smoothed[smoothed.length - 1]).toBe(40);
  });
});
