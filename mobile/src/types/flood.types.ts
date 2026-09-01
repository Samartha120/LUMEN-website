/**
 * Flood telemetry, stormwater drain levels, and lake sensor monitor types.
 */

import { GeoCoordinate } from './civic.types';

export type WaterLevelStatus = 'NORMAL' | 'ELEVATED' | 'WARNING' | 'OVERFLOW_DANGER';

export interface StormwaterSensor {
  sensorId: string;
  locationName: string;
  coordinate: GeoCoordinate;
  sensorType: 'DRAIN_DEPTH' | 'LAKE_INFLOW' | 'ROAD_SUBMERSION';
  currentDepthMeters: number;
  maxCapacityMeters: number;
  capacityUtilizationPercentage: number;
  status: WaterLevelStatus;
  rateOfRiseCmPerHour: number;
  rainfallLast24HoursMm: number;
  lastUpdated: string;
  isDesiltingRequired: boolean;
  pumpStationActive: boolean;
}

export interface FloodAlertPerimeter {
  id: string;
  zoneName: string;
  status: WaterLevelStatus;
  affectedStreets: string[];
  recommendedEvacuationRoutes: string[];
  safeShelters: Array<{ name: string; address: string; capacity: number }>;
  sensors: StormwaterSensor[];
  lastAssessedAt: string;
}
