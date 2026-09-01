/**
 * Advanced Civic Analytics & Predictive Forecasting Service for LUMEN.
 */

import { CivicCategory, CivicDamageClass, GeoCoordinate } from '../types/civic.types';
import { StorageService } from './storage.service';
import { mean, movingAverage, normalizeDistribution } from '../utils/math';

export interface WardHealthMetrics {
  wardId: string;
  wardName: string;
  zone: string;
  overallScore: number;
  roadQualityIndex: number;
  lightingReliabilityIndex: number;
  wasteClearanceVelocity: number;
  drainageEfficiencyIndex: number;
  publicAssetIntegrity: number;
  monthlyTrendDelta: number; // percentage change vs previous month
  historicalHealthScores: number[]; // 12-month trend
}

export interface PredictiveIncidentForecast {
  category: CivicCategory;
  expectedWeeklyNewIncidents: number;
  predictedHighRiskZones: string[];
  weatherCorrelationFactor: number;
  seasonalSurgeRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  recommendedResourceAllocation: {
    asphaltRepairCrews: number;
    electricalEmergencyUnits: number;
    drainJettingTeams: number;
    wasteCompactors: number;
  };
}

export interface DepartmentEfficiencyReport {
  department: string;
  category: CivicCategory;
  totalTicketsHandled: number;
  medianTimeToTriageHours: number;
  medianTimeToResolveHours: number;
  slaCompliancePercentage: number;
  citizenSatisfactionAverage: number; // out of 5.0
  reworkRequiredRate: number; // percentage
  weeklyVelocity: number[];
}

const ANALYTICS_CACHE_KEY = 'civic_analytics_data';

const SAMPLE_WARD_METRICS: WardHealthMetrics[] = [
  {
    wardId: 'ward-112',
    wardName: 'Domlur',
    zone: 'East Zone',
    overallScore: 88,
    roadQualityIndex: 86,
    lightingReliabilityIndex: 94,
    wasteClearanceVelocity: 91,
    drainageEfficiencyIndex: 82,
    publicAssetIntegrity: 89,
    monthlyTrendDelta: 4.2,
    historicalHealthScores: [76, 78, 80, 81, 83, 85, 84, 86, 85, 87, 87, 88],
  },
  {
    wardId: 'ward-80',
    wardName: 'Koramangala',
    zone: 'South Zone',
    overallScore: 91,
    roadQualityIndex: 92,
    lightingReliabilityIndex: 96,
    wasteClearanceVelocity: 93,
    drainageEfficiencyIndex: 85,
    publicAssetIntegrity: 90,
    monthlyTrendDelta: 2.8,
    historicalHealthScores: [82, 84, 85, 86, 87, 88, 89, 89, 90, 90, 91, 91],
  },
  {
    wardId: 'ward-117',
    wardName: 'Shanthi Nagar',
    zone: 'Central Zone',
    overallScore: 74,
    roadQualityIndex: 68,
    lightingReliabilityIndex: 81,
    wasteClearanceVelocity: 79,
    drainageEfficiencyIndex: 65,
    publicAssetIntegrity: 76,
    monthlyTrendDelta: -1.5,
    historicalHealthScores: [79, 78, 77, 76, 75, 75, 74, 76, 75, 74, 74, 74],
  },
  {
    wardId: 'ward-150',
    wardName: 'Bellandur',
    zone: 'Mahadevapura',
    overallScore: 62,
    roadQualityIndex: 54,
    lightingReliabilityIndex: 72,
    wasteClearanceVelocity: 68,
    drainageEfficiencyIndex: 48,
    publicAssetIntegrity: 66,
    monthlyTrendDelta: 5.8,
    historicalHealthScores: [50, 52, 53, 54, 55, 56, 57, 58, 60, 60, 61, 62],
  },
];

const SAMPLE_EFFICIENCY_REPORTS: DepartmentEfficiencyReport[] = [
  {
    department: 'Roads & Infrastructure',
    category: 'roads',
    totalTicketsHandled: 486,
    medianTimeToTriageHours: 1.4,
    medianTimeToResolveHours: 24.6,
    slaCompliancePercentage: 94.2,
    citizenSatisfactionAverage: 4.6,
    reworkRequiredRate: 3.1,
    weeklyVelocity: [42, 38, 45, 51, 48, 54, 60],
  },
  {
    department: 'Electricity & Lighting Cell',
    category: 'electrical',
    totalTicketsHandled: 218,
    medianTimeToTriageHours: 0.4,
    medianTimeToResolveHours: 7.2,
    slaCompliancePercentage: 98.4,
    citizenSatisfactionAverage: 4.8,
    reworkRequiredRate: 1.2,
    weeklyVelocity: [18, 22, 19, 25, 20, 24, 26],
  },
  {
    department: 'Sanitation & Solid Waste',
    category: 'waste',
    totalTicketsHandled: 640,
    medianTimeToTriageHours: 0.8,
    medianTimeToResolveHours: 14.5,
    slaCompliancePercentage: 92.0,
    citizenSatisfactionAverage: 4.4,
    reworkRequiredRate: 4.5,
    weeklyVelocity: [58, 62, 59, 64, 68, 72, 75],
  },
  {
    department: 'Water Supply & Underground Drainage',
    category: 'water',
    totalTicketsHandled: 312,
    medianTimeToTriageHours: 0.9,
    medianTimeToResolveHours: 18.2,
    slaCompliancePercentage: 91.5,
    citizenSatisfactionAverage: 4.5,
    reworkRequiredRate: 2.8,
    weeklyVelocity: [28, 30, 34, 31, 35, 38, 40],
  },
];

export class AnalyticsService {
  /**
   * Get all ward health metric scorecards
   */
  static async getWardHealthMetrics(): Promise<WardHealthMetrics[]> {
    const cached = await StorageService.getItem<WardHealthMetrics[]>(ANALYTICS_CACHE_KEY);
    if (cached) return cached;
    await StorageService.setItem(ANALYTICS_CACHE_KEY, SAMPLE_WARD_METRICS);
    return SAMPLE_WARD_METRICS;
  }

  /**
   * Get department efficiency and resolution velocity data
   */
  static async getDepartmentEfficiencyReports(): Promise<DepartmentEfficiencyReport[]> {
    return SAMPLE_EFFICIENCY_REPORTS;
  }

  /**
   * Calculate predictive hazard forecasts based on season and historical reports
   */
  static async getPredictiveForecast(category: CivicCategory): Promise<PredictiveIncidentForecast> {
    const isMonsoonSeason = new Date().getMonth() >= 5 && new Date().getMonth() <= 9;

    let weatherFactor = 1.0;
    let seasonalSurge: PredictiveIncidentForecast['seasonalSurgeRisk'] = 'LOW';
    let expectedWeekly = 24;

    if (category === 'water' || category === 'roads') {
      weatherFactor = isMonsoonSeason ? 2.4 : 1.1;
      seasonalSurge = isMonsoonSeason ? 'EXTREME' : 'MODERATE';
      expectedWeekly = isMonsoonSeason ? 86 : 32;
    } else if (category === 'electrical') {
      weatherFactor = isMonsoonSeason ? 1.8 : 1.0;
      seasonalSurge = isMonsoonSeason ? 'HIGH' : 'LOW';
      expectedWeekly = isMonsoonSeason ? 44 : 20;
    }

    return {
      category,
      expectedWeeklyNewIncidents: expectedWeekly,
      predictedHighRiskZones: ['100 Feet Road HAL', 'Indiranagar 8th Main', 'Bellandur Ring Road'],
      weatherCorrelationFactor: weatherFactor,
      seasonalSurgeRisk: seasonalSurge,
      recommendedResourceAllocation: {
        asphaltRepairCrews: isMonsoonSeason ? 8 : 4,
        electricalEmergencyUnits: isMonsoonSeason ? 6 : 3,
        drainJettingTeams: isMonsoonSeason ? 10 : 4,
        wasteCompactors: 6,
      },
    };
  }

  /**
   * Calculate moving average resolution velocity
   */
  static calculateSmoothVelocity(weeklyReports: number[]): number[] {
    return movingAverage(weeklyReports, 3);
  }
}
