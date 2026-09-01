/**
 * Real-time tracking and dispatch telemetry types.
 */

import { CivicLocation, GeoCoordinate, PriorityLevel } from './civic.types';

export type TrackingStage =
  | 'QUEUED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ARRIVED_ON_SITE'
  | 'REPAIR_IN_PROGRESS'
  | 'QUALITY_INSPECTION'
  | 'COMPLETED';

export interface MilestoneUpdate {
  stage: TrackingStage;
  title: string;
  description: string;
  timestamp: string;
  completed: boolean;
  active: boolean;
  estimatedTime?: string;
  proofPhotoUrl?: string;
  performedBy?: string;
}

export interface EngineerTelemetry {
  engineerId: string;
  name: string;
  phone: string;
  vehicleNumber?: string;
  currentLocation: GeoCoordinate;
  headingDegrees?: number;
  speedKmh?: number;
  lastUpdated: string;
  batteryLevel?: number;
}

export interface LiveComplaintTracking {
  complaintId: string;
  ticketNumber: string;
  currentStage: TrackingStage;
  priority: PriorityLevel;
  slaDeadline: string;
  slaRemainingMinutes: number;
  isOverdue: boolean;
  incidentLocation: CivicLocation;
  assignedEngineer?: EngineerTelemetry;
  routeWaypoints?: GeoCoordinate[];
  estimatedArrivalMinutes?: number;
  distanceRemainingMeters?: number;
  milestones: MilestoneUpdate[];
  canEscalate: boolean;
  escalationCount: number;
  lastEscalatedAt?: string;
}

export interface EscalationRequest {
  complaintId: string;
  reason: 'SLA_BREACH' | 'HAZARD_INCREASED' | 'NO_WORKER_ON_SITE' | 'INCORRECT_REPAIR' | 'EMERGENCY_RISK';
  note: string;
  urgencyBoost: boolean;
  timestamp: string;
}
