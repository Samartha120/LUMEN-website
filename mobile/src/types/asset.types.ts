/**
 * Municipal asset registration, QR tagging, and inspection types.
 */

import { CivicCategory, CivicLocation } from './civic.types';

export type AssetType =
  | 'STREETLIGHT_POLE'
  | 'TRANSFORMER_UNIT'
  | 'PUBLIC_WATER_TAP'
  | 'MANHOLE_CHAMBER'
  | 'BUS_SHELTER'
  | 'WASTE_BIN_STATION'
  | 'ROAD_SIGNAGE';

export type AssetHealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL_FAULT' | 'UNDER_MAINTENANCE';

export interface MaintenanceRecord {
  id: string;
  servicedAt: string;
  servicedByEngineerName: string;
  workDescription: string;
  partsReplaced: string[];
  statusAfterService: AssetHealthStatus;
  inspectionPhotoUrl?: string;
}

export interface MunicipalAsset {
  id: string;
  qrCodeTag: string;
  assetType: AssetType;
  category: CivicCategory;
  name: string;
  specification: string;
  installationDate: string;
  location: CivicLocation;
  healthStatus: AssetHealthStatus;
  healthScore: number; // 0 - 100
  lastInspectedAt: string;
  nextScheduledInspection: string;
  wardNumber: string;
  installedByContractor: string;
  activeComplaintsCount: number;
  maintenanceHistory: MaintenanceRecord[];
}
