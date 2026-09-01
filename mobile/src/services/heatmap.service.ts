/**
 * Heatmap & Spatial Density Service for LUMEN Civic Analytics.
 */

import { HeatmapPoint, IncidentCluster, WardSafetyScore, HeatmapLayerFilter } from '../types/heatmap.types';
import { GeoCoordinate } from '../types/civic.types';

const SAMPLE_HEATMAP_POINTS: HeatmapPoint[] = [
  {
    id: 'hp-1',
    coordinate: { latitude: 12.9716, longitude: 77.5946 },
    weight: 0.95,
    category: 'roads',
    damageClass: 'pothole',
    priority: 'HIGH',
    complaintCount: 8,
    radiusMeters: 180,
  },
  {
    id: 'hp-2',
    coordinate: { latitude: 12.9740, longitude: 77.5990 },
    weight: 0.85,
    category: 'electrical',
    damageClass: 'exposed_wire',
    priority: 'CRITICAL',
    complaintCount: 4,
    radiusMeters: 140,
  },
  {
    id: 'hp-3',
    coordinate: { latitude: 12.9680, longitude: 77.5910 },
    weight: 0.65,
    category: 'waste',
    damageClass: 'overflowing_bin',
    priority: 'MEDIUM',
    complaintCount: 12,
    radiusMeters: 200,
  },
  {
    id: 'hp-4',
    coordinate: { latitude: 12.9795, longitude: 77.6408 },
    weight: 0.78,
    category: 'water',
    damageClass: 'waterlogging',
    priority: 'HIGH',
    complaintCount: 7,
    radiusMeters: 220,
  },
  {
    id: 'hp-5',
    coordinate: { latitude: 12.9820, longitude: 77.6450 },
    weight: 0.50,
    category: 'public_property',
    damageClass: 'broken_footpath',
    priority: 'LOW',
    complaintCount: 5,
    radiusMeters: 150,
  },
  {
    id: 'hp-6',
    coordinate: { latitude: 12.9650, longitude: 77.6040 },
    weight: 0.90,
    category: 'water',
    damageClass: 'open_manhole',
    priority: 'CRITICAL',
    complaintCount: 3,
    radiusMeters: 120,
  },
];

const WARD_SAFETY_DATA: WardSafetyScore[] = [
  {
    wardNumber: 'Ward 112',
    wardName: 'Domlur',
    zone: 'East Zone',
    safetyScore: 84,
    infrastructureHealthScore: 88,
    potholeDensityPerKm: 1.4,
    avgResolutionHours: 28.5,
    openIssuesCount: 9,
    resolvedIssuesThisMonth: 64,
    rank: 3,
  },
  {
    wardNumber: 'Ward 117',
    wardName: 'Shanthi Nagar',
    zone: 'Central Zone',
    safetyScore: 71,
    infrastructureHealthScore: 74,
    potholeDensityPerKm: 3.2,
    avgResolutionHours: 36.2,
    openIssuesCount: 22,
    resolvedIssuesThisMonth: 48,
    rank: 12,
  },
  {
    wardNumber: 'Ward 150',
    wardName: 'Bellandur',
    zone: 'Mahadevapura',
    safetyScore: 58,
    infrastructureHealthScore: 62,
    potholeDensityPerKm: 5.8,
    avgResolutionHours: 54.0,
    openIssuesCount: 47,
    resolvedIssuesThisMonth: 82,
    rank: 28,
  },
  {
    wardNumber: 'Ward 80',
    wardName: 'Koramangala',
    zone: 'South Zone',
    safetyScore: 89,
    infrastructureHealthScore: 91,
    potholeDensityPerKm: 0.9,
    avgResolutionHours: 21.0,
    openIssuesCount: 6,
    resolvedIssuesThisMonth: 75,
    rank: 1,
  },
];

export class HeatmapService {
  /**
   * Get density points filtered by layers and categories
   */
  static async getHeatmapPoints(filter?: Partial<HeatmapLayerFilter>): Promise<HeatmapPoint[]> {
    let points = [...SAMPLE_HEATMAP_POINTS];

    if (filter?.categories && filter.categories.length > 0) {
      points = points.filter(p => filter.categories!.includes(p.category));
    }

    if (filter?.minSeverity !== undefined) {
      points = points.filter(p => p.weight * 100 >= filter.minSeverity!);
    }

    return points;
  }

  /**
   * Cluster points into spatial incident hotzones
   */
  static async getIncidentClusters(): Promise<IncidentCluster[]> {
    const clusters: IncidentCluster[] = [
      {
        id: 'cluster-1',
        centroid: { latitude: 12.9716, longitude: 77.5946 },
        pointCount: 14,
        dominantCategory: 'roads',
        averageSeverity: 82,
        boundingPolygon: [
          { latitude: 12.9730, longitude: 77.5930 },
          { latitude: 12.9735, longitude: 77.5960 },
          { latitude: 12.9700, longitude: 77.5965 },
          { latitude: 12.9695, longitude: 77.5935 },
        ],
        activeTicketNumbers: ['LMN-8021', 'LMN-8034', 'LMN-8049'],
        lastReportedAt: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
        clusterRadiusMeters: 450,
        hazardLevel: 'CRITICAL',
      },
      {
        id: 'cluster-2',
        centroid: { latitude: 12.9800, longitude: 77.6420 },
        pointCount: 8,
        dominantCategory: 'water',
        averageSeverity: 68,
        boundingPolygon: [
          { latitude: 12.9820, longitude: 77.6400 },
          { latitude: 12.9825, longitude: 77.6440 },
          { latitude: 12.9780, longitude: 77.6445 },
          { latitude: 12.9775, longitude: 77.6405 },
        ],
        activeTicketNumbers: ['LMN-8012', 'LMN-8018'],
        lastReportedAt: new Date(Date.now() - 1000 * 3600 * 8).toISOString(),
        clusterRadiusMeters: 320,
        hazardLevel: 'ELEVATED',
      },
    ];

    return clusters;
  }

  /**
   * Fetch ward health and safety index ranking
   */
  static async getWardSafetyScores(): Promise<WardSafetyScore[]> {
    return [...WARD_SAFETY_DATA].sort((a, b) => b.safetyScore - a.safetyScore);
  }

  /**
   * Calculate proximity to nearest hazard cluster in meters
   */
  static calculateDistance(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
    const R = 6371e3; // Earth radius in metres
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }
}
