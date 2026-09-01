/**
 * Spatial heatmap and density types for LUMEN civic analytics.
 */

import { CivicCategory, CivicDamageClass, GeoCoordinate, PriorityLevel } from './civic.types';

export interface HeatmapPoint {
  id: string;
  coordinate: GeoCoordinate;
  weight: number; // 0.0 - 1.0 (normalized by severity and count)
  category: CivicCategory;
  damageClass: CivicDamageClass;
  priority: PriorityLevel;
  complaintCount: number;
  radiusMeters: number;
}

export interface IncidentCluster {
  id: string;
  centroid: GeoCoordinate;
  pointCount: number;
  dominantCategory: CivicCategory;
  averageSeverity: number;
  boundingPolygon: GeoCoordinate[];
  activeTicketNumbers: string[];
  lastReportedAt: string;
  clusterRadiusMeters: number;
  hazardLevel: 'SAFE' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
}

export interface WardSafetyScore {
  wardNumber: string;
  wardName: string;
  zone: string;
  safetyScore: number; // 0 - 100
  infrastructureHealthScore: number; // 0 - 100
  potholeDensityPerKm: number;
  avgResolutionHours: number;
  openIssuesCount: number;
  resolvedIssuesThisMonth: number;
  rank: number;
}

export interface HeatmapLayerFilter {
  categories: CivicCategory[];
  showResolved: boolean;
  minSeverity: number;
  timeRangeDays: number;
  densityRadiusMultiplier: number;
  selectedWard?: string;
}
