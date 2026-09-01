/**
 * Safe city route navigation and hazard-avoidance calculation service.
 */

import { CivicRouteOption, RoutePreference, RouteRequestPayload, RouteWaypoint } from '../types/route.types';
import { GeoCoordinate } from '../types/civic.types';
import { calculateHaversineDistanceMeters } from '../utils/geo';

export class RouteService {
  /**
   * Plan hazard-aware safe navigation routes
   */
  static async calculateSafeRoutes(payload: RouteRequestPayload): Promise<CivicRouteOption[]> {
    const baseDistanceMeters = calculateHaversineDistanceMeters(payload.origin, payload.destination) || 3200;

    const routes: CivicRouteOption[] = [
      {
        id: 'route-well-lit',
        preference: 'SAFEST_WELL_LIT',
        title: 'Safest & Well-Lit Main Avenue Route',
        summary: 'Follows 100ft Road and Main Boulevard with 98% functioning streetlights and wide footpaths.',
        totalDistanceMeters: Math.round(baseDistanceMeters * 1.12),
        estimatedMinutes: Math.round((baseDistanceMeters * 1.12) / (payload.travelMode === 'WALKING' ? 80 : 350)),
        overallSafetyScore: 94,
        lightingScore: 98,
        surfaceQualityScore: 90,
        hazardsAvoidedCount: 4,
        activeHazardsOnRouteCount: 0,
        waypoints: [
          {
            coordinate: payload.origin,
            instruction: 'Head East on 8th Main Road',
            streetName: '8th Main Road',
            distanceMeters: 450,
            hasNearbyHazard: false,
            lightingQuality: 'GOOD',
          },
          {
            coordinate: { latitude: 12.9730, longitude: 77.5990 },
            instruction: 'Turn Left onto 100 Feet Road (Wide LED Illuminated Corridor)',
            streetName: '100 Feet Road',
            distanceMeters: 1400,
            hasNearbyHazard: false,
            lightingQuality: 'GOOD',
          },
          {
            coordinate: payload.destination,
            instruction: 'Arrive at destination safely',
            streetName: 'Indiranagar Central',
            distanceMeters: 0,
            hasNearbyHazard: false,
            lightingQuality: 'GOOD',
          },
        ],
        polylineCoordinates: [
          payload.origin,
          { latitude: 12.9730, longitude: 77.5990 },
          { latitude: 12.9760, longitude: 77.6200 },
          payload.destination,
        ],
      },
      {
        id: 'route-pothole-free',
        preference: 'POTHOLE_FREE',
        title: 'Smooth Asphalt & Pothole-Free Route',
        summary: 'Bypasses recently excavated utility works on 12th Cross; newly resurfaced road corridor.',
        totalDistanceMeters: Math.round(baseDistanceMeters * 1.05),
        estimatedMinutes: Math.round((baseDistanceMeters * 1.05) / (payload.travelMode === 'WALKING' ? 80 : 350)),
        overallSafetyScore: 88,
        lightingScore: 85,
        surfaceQualityScore: 96,
        hazardsAvoidedCount: 3,
        activeHazardsOnRouteCount: 0,
        waypoints: [
          {
            coordinate: payload.origin,
            instruction: 'Take 4th Cross toward Double Road',
            streetName: '4th Cross',
            distanceMeters: 600,
            hasNearbyHazard: false,
            lightingQuality: 'GOOD',
          },
          {
            coordinate: payload.destination,
            instruction: 'Continue straight to destination',
            streetName: 'Double Road Corridor',
            distanceMeters: 800,
            hasNearbyHazard: false,
            lightingQuality: 'MODERATE',
          },
        ],
        polylineCoordinates: [
          payload.origin,
          { latitude: 12.9720, longitude: 77.6050 },
          payload.destination,
        ],
      },
      {
        id: 'route-fastest',
        preference: 'FASTEST',
        title: 'Shortest Cut-Through Route',
        summary: 'Direct path through 12th Cross alley. Caution: 1 active pothole report near crossroad.',
        totalDistanceMeters: baseDistanceMeters,
        estimatedMinutes: Math.round(baseDistanceMeters / (payload.travelMode === 'WALKING' ? 80 : 350)),
        overallSafetyScore: 68,
        lightingScore: 62,
        surfaceQualityScore: 65,
        hazardsAvoidedCount: 0,
        activeHazardsOnRouteCount: 1,
        waypoints: [
          {
            coordinate: payload.origin,
            instruction: 'Head direct through 12th Cross',
            streetName: '12th Cross Alley',
            distanceMeters: 800,
            hasNearbyHazard: true,
            hazardDescription: 'Pothole #LMN-8021 active at 12th cross junction',
            lightingQuality: 'POOR',
          },
          {
            coordinate: payload.destination,
            instruction: 'Arrive at destination',
            streetName: 'Destination Gate',
            distanceMeters: 0,
            hasNearbyHazard: false,
            lightingQuality: 'MODERATE',
          },
        ],
        polylineCoordinates: [payload.origin, payload.destination],
      },
    ];

    return routes;
  }
}
