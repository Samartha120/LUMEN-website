/**
 * Emergency hazard broadcast and geofence alerting types.
 */

import { CivicCategory, CivicDamageClass, GeoCoordinate } from './civic.types';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL_HAZARD' | 'LIFE_THREATENING';

export interface HazardBroadcast {
  id: string;
  ticketId?: string;
  title: string;
  summary: string;
  description: string;
  category: CivicCategory;
  damageClass: CivicDamageClass;
  severity: AlertSeverity;
  affectedRadiusMeters: number;
  centerCoordinate: GeoCoordinate;
  address: string;
  evacuationOrSafetyInstructions: string[];
  safeDetourNotes?: string;
  emergencyContactNumbers: Array<{ label: string; number: string }>;
  broadcastedAt: string;
  expiresAt: string;
  isActive: boolean;
  acknowledgedCount: number;
  hasUserAcknowledged?: boolean;
}

export interface GeofenceSubscription {
  id: string;
  label: string; // e.g. "Home", "Office", "Kids School"
  center: GeoCoordinate;
  radiusMeters: number;
  categories: CivicCategory[];
  minimumSeverity: AlertSeverity;
  pushEnabled: boolean;
  smsEnabled?: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  notifyOnSos: boolean;
}
