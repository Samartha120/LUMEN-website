/**
 * Geospatial utility functions for LUMEN mobile application.
 */

import { GeoCoordinate } from '../types/civic.types';

export interface BoundingBoxCoordinates {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Calculate Haversine distance between two coordinates in meters
 */
export function calculateHaversineDistanceMeters(c1: GeoCoordinate, c2: GeoCoordinate): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLng = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const lat1 = (c1.latitude * Math.PI) / 180;
  const lat2 = (c2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Format distance in human-readable metric units
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Check if a point is inside a polygon using ray-casting algorithm
 */
export function isPointInsidePolygon(point: GeoCoordinate, polygon: GeoCoordinate[]): boolean {
  let inside = false;
  const x = point.latitude;
  const y = point.longitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate bounding box around a center point given a radius in meters
 */
export function getBoundingBox(center: GeoCoordinate, radiusMeters: number): BoundingBoxCoordinates {
  const earthRadius = 6371000;
  const latDelta = (radiusMeters / earthRadius) * (180 / Math.PI);
  const lngDelta =
    ((radiusMeters / (earthRadius * Math.cos((center.latitude * Math.PI) / 180))) * 180) / Math.PI;

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

/**
 * Format coordinates as standard DMS (Degrees Minutes Seconds) or Decimal
 */
export function formatCoordinate(coord: GeoCoordinate, format: 'DMS' | 'DECIMAL' = 'DECIMAL'): string {
  if (format === 'DECIMAL') {
    return `${coord.latitude.toFixed(5)}° N, ${coord.longitude.toFixed(5)}° E`;
  }

  const toDms = (deg: number) => {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
    return `${degrees}°${minutes}'${seconds}"`;
  };

  const latDir = coord.latitude >= 0 ? 'N' : 'S';
  const lngDir = coord.longitude >= 0 ? 'E' : 'W';

  return `${toDms(coord.latitude)}${latDir}, ${toDms(coord.longitude)}${lngDir}`;
}
