/**
 * Safe civic route planning and hazard avoidance types.
 */

import { GeoCoordinate } from './civic.types';

export type RoutePreference = 'SAFEST_WELL_LIT' | 'POTHOLE_FREE' | 'FASTEST' | 'PEDESTRIAN_FRIENDLY';

export interface RouteWaypoint {
  coordinate: GeoCoordinate;
  instruction: string;
  streetName: string;
  distanceMeters: number;
  hasNearbyHazard: boolean;
  hazardDescription?: string;
  lightingQuality: 'GOOD' | 'MODERATE' | 'POOR';
}

export interface CivicRouteOption {
  id: string;
  preference: RoutePreference;
  title: string;
  summary: string;
  totalDistanceMeters: number;
  estimatedMinutes: number;
  overallSafetyScore: number; // 0 - 100
  lightingScore: number; // 0 - 100
  surfaceQualityScore: number; // 0 - 100
  hazardsAvoidedCount: number;
  activeHazardsOnRouteCount: number;
  waypoints: RouteWaypoint[];
  polylineCoordinates: GeoCoordinate[];
}

export interface RouteRequestPayload {
  origin: GeoCoordinate;
  destination: GeoCoordinate;
  preference: RoutePreference;
  travelMode: 'WALKING' | 'TWO_WHEELER' | 'DRIVING';
  avoidWaterloggedZones: boolean;
  avoidUnlitStreets: boolean;
}
