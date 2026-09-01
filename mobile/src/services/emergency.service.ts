/**
 * Emergency hazard alerts, SOS broadcasts, and safe route detour service.
 */

import { HazardBroadcast, GeofenceSubscription, EmergencyContact } from '../types/emergency.types';
import { GeoCoordinate } from '../types/civic.types';
import { StorageService } from './storage.service';
import { HeatmapService } from './heatmap.service';

const HAZARD_CACHE_KEY = 'hazard_broadcasts';
const GEOFENCE_CACHE_KEY = 'geofence_subscriptions';
const EMERGENCY_CONTACTS_KEY = 'emergency_contacts';

const SAMPLE_HAZARDS: HazardBroadcast[] = [
  {
    id: 'hz-901',
    ticketId: 'LMN-EMG-101',
    title: 'High Voltage Live Cable Snap on 12th Cross',
    summary: 'Overhead transformer line snapped and lying across waterlogged street.',
    description: 'Bescom emergency power isolation squad has been alerted. Power is being cut to Substation 4. DO NOT approach within 50 meters of standing water.',
    category: 'electrical',
    damageClass: 'exposed_wire',
    severity: 'LIFE_THREATENING',
    affectedRadiusMeters: 300,
    centerCoordinate: { latitude: 12.9740, longitude: 77.5990 },
    address: '12th Cross, Near Shanthi Sagar Hotel, Shanthi Nagar',
    evacuationOrSafetyInstructions: [
      'Maintain at least 50 meters distance from all metal poles and standing water',
      'Use 14th Cross as an alternate route toward Double Road',
      'Keep children and pets strictly indoors until power team verifies grounding',
    ],
    safeDetourNotes: 'Traffic redirected through 14th Cross onto Mission Road.',
    emergencyContactNumbers: [
      { label: 'BESCOM Electricity Emergency', number: '1912' },
      { label: 'City Disaster Control Room', number: '1077' },
      { label: 'Police Control', number: '112' },
    ],
    broadcastedAt: new Date(Date.now() - 1000 * 3600 * 0.5).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 3600 * 4).toISOString(),
    isActive: true,
    acknowledgedCount: 342,
    hasUserAcknowledged: false,
  },
  {
    id: 'hz-902',
    ticketId: 'LMN-EMG-102',
    title: 'Open Stormwater Drain & Missing Manhole Slab',
    summary: 'Submerged drain opening obscured by 1-foot water accumulation.',
    description: 'Heavy rain has displaced a 2-meter concrete slab over the primary stormwater canal. High hazard for two-wheelers and pedestrians.',
    category: 'water',
    damageClass: 'open_manhole',
    severity: 'CRITICAL_HAZARD',
    affectedRadiusMeters: 200,
    centerCoordinate: { latitude: 12.9650, longitude: 77.6040 },
    address: 'Opposite Government Primary School, Wilson Garden',
    evacuationOrSafetyInstructions: [
      'Avoid walking or riding on the left shoulder of the road',
      'Caution barricades have been placed by local traffic police',
    ],
    safeDetourNotes: 'Take 10th Cross bypass via Lalbagh Fort Road.',
    emergencyContactNumbers: [
      { label: 'BWSSB Water & Drainage Help', number: '1916' },
      { label: 'Traffic Police Helpline', number: '1095' },
    ],
    broadcastedAt: new Date(Date.now() - 1000 * 3600 * 1.8).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 3600 * 6).toISOString(),
    isActive: true,
    acknowledgedCount: 188,
    hasUserAcknowledged: true,
  },
];

const DEFAULT_GEOFENCES: GeofenceSubscription[] = [
  {
    id: 'geo-1',
    label: 'Home Zone',
    center: { latitude: 12.9716, longitude: 77.5946 },
    radiusMeters: 1500,
    categories: ['roads', 'electrical', 'waste', 'water', 'public_property'],
    minimumSeverity: 'WARNING',
    pushEnabled: true,
    smsEnabled: true,
  },
  {
    id: 'geo-2',
    label: 'Work / Tech Park',
    center: { latitude: 12.9352, longitude: 77.6245 },
    radiusMeters: 2000,
    categories: ['roads', 'electrical', 'water'],
    minimumSeverity: 'CRITICAL_HAZARD',
    pushEnabled: true,
    smsEnabled: false,
  },
];

export class EmergencyService {
  /**
   * Get active hazard broadcasts
   */
  static async getActiveHazards(userCoordinate?: GeoCoordinate): Promise<Array<HazardBroadcast & { distanceMeters?: number }>> {
    let hazards = await StorageService.getItem<HazardBroadcast[]>(HAZARD_CACHE_KEY);
    if (!hazards || hazards.length === 0) {
      hazards = SAMPLE_HAZARDS;
      await StorageService.setItem(HAZARD_CACHE_KEY, hazards);
    }

    const active = hazards.filter(h => h.isActive);

    if (userCoordinate) {
      return active.map(h => {
        const dist = HeatmapService.calculateDistance(userCoordinate, h.centerCoordinate);
        return { ...h, distanceMeters: dist };
      }).sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    }

    return active;
  }

  /**
   * Acknowledge a hazard alert
   */
  static async acknowledgeHazard(hazardId: string): Promise<void> {
    const hazards = await this.getActiveHazards();
    const target = hazards.find(h => h.id === hazardId);
    if (target && !target.hasUserAcknowledged) {
      target.hasUserAcknowledged = true;
      target.acknowledgedCount += 1;
      await StorageService.setItem(HAZARD_CACHE_KEY, hazards);
    }
  }

  /**
   * Get geofence subscriptions
   */
  static async getGeofenceSubscriptions(): Promise<GeofenceSubscription[]> {
    const subs = await StorageService.getItem<GeofenceSubscription[]>(GEOFENCE_CACHE_KEY);
    if (!subs) {
      await StorageService.setItem(GEOFENCE_CACHE_KEY, DEFAULT_GEOFENCES);
      return DEFAULT_GEOFENCES;
    }
    return subs;
  }

  /**
   * Save geofence subscription
   */
  static async saveGeofenceSubscription(sub: GeofenceSubscription): Promise<GeofenceSubscription[]> {
    const subs = await this.getGeofenceSubscriptions();
    const index = subs.findIndex(s => s.id === sub.id);
    if (index >= 0) {
      subs[index] = sub;
    } else {
      subs.push(sub);
    }
    await StorageService.setItem(GEOFENCE_CACHE_KEY, subs);
    return subs;
  }
}
