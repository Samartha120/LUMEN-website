/**
 * Municipal asset registration, QR scanner, and component health tracker service.
 */

import { MunicipalAsset } from '../types/asset.types';
import { StorageService } from './storage.service';

const ASSETS_CACHE_KEY = 'municipal_assets_registry';

const SAMPLE_ASSETS: MunicipalAsset[] = [
  {
    id: 'ast-1001',
    qrCodeTag: 'LMN-QR-BLR-00812',
    assetType: 'STREETLIGHT_POLE',
    category: 'electrical',
    name: 'Octagonal LED Pole #812',
    specification: '60W Warm White Philips LED Fixture, 8m Galvanized Steel',
    installationDate: '2024-03-15',
    location: {
      coordinate: { latitude: 12.9716, longitude: 77.5946 },
      address: 'Opposite Metro Pillar 142, 8th Main, Indiranagar',
      ward: 'Ward 112 - Domlur',
    },
    healthStatus: 'OPERATIONAL',
    healthScore: 92,
    lastInspectedAt: new Date(Date.now() - 86400 * 1000 * 14).toISOString(),
    nextScheduledInspection: new Date(Date.now() + 86400 * 1000 * 45).toISOString(),
    wardNumber: 'Ward 112',
    installedByContractor: 'L&T Smart Infrastructure Ltd',
    activeComplaintsCount: 0,
    maintenanceHistory: [
      {
        id: 'mnt-1',
        servicedAt: '2025-08-10',
        servicedByEngineerName: 'Suresh Babu (Electrician)',
        workDescription: 'Replaced dusk-to-dawn photosensor and tightened base anchors.',
        partsReplaced: ['Photosensor Relay 10A'],
        statusAfterService: 'OPERATIONAL',
      },
    ],
  },
  {
    id: 'ast-1002',
    qrCodeTag: 'LMN-QR-BLR-00419',
    assetType: 'TRANSFORMER_UNIT',
    category: 'electrical',
    name: 'Distribution Transformer Substation #419',
    specification: '250 kVA Oil-Cooled Step-Down Transformer (11kV to 415V)',
    installationDate: '2023-11-20',
    location: {
      coordinate: { latitude: 12.9740, longitude: 77.5990 },
      address: '12th Cross Junction, Shanthi Nagar',
      ward: 'Ward 117 - Shanthi Nagar',
    },
    healthStatus: 'CRITICAL_FAULT',
    healthScore: 48,
    lastInspectedAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
    nextScheduledInspection: new Date(Date.now() + 86400 * 1000 * 1).toISOString(),
    wardNumber: 'Ward 117',
    installedByContractor: 'ABB Power Systems India',
    activeComplaintsCount: 1,
    maintenanceHistory: [
      {
        id: 'mnt-2',
        servicedAt: '2025-12-04',
        servicedByEngineerName: 'Manoj Tiwari (Substation Lead)',
        workDescription: 'Breaker trip test and oil dielectric strength test.',
        partsReplaced: ['HT Fuse 20A'],
        statusAfterService: 'OPERATIONAL',
      },
    ],
  },
  {
    id: 'ast-1003',
    qrCodeTag: 'LMN-QR-BLR-00994',
    assetType: 'MANHOLE_CHAMBER',
    category: 'water',
    name: 'Stormwater Primary Manhole #994',
    specification: 'Heavy Duty 40-Tonne Ductile Iron Hinged Cover, 900mm Dia',
    installationDate: '2024-06-10',
    location: {
      coordinate: { latitude: 12.9650, longitude: 77.6040 },
      address: 'Main Road Drain Culvert, Wilson Garden',
      ward: 'Ward 117 - Shanthi Nagar',
    },
    healthStatus: 'OPERATIONAL',
    healthScore: 85,
    lastInspectedAt: new Date(Date.now() - 86400 * 1000 * 20).toISOString(),
    nextScheduledInspection: new Date(Date.now() + 86400 * 1000 * 30).toISOString(),
    wardNumber: 'Ward 117',
    installedByContractor: 'BBMP Stormwater Project Cell',
    activeComplaintsCount: 0,
    maintenanceHistory: [],
  },
];

export class AssetService {
  /**
   * Scan or lookup asset by QR code tag or ID
   */
  static async getAssetByTag(tagOrId: string): Promise<MunicipalAsset | null> {
    const assets = await this.getAllAssets();
    const cleanTag = tagOrId.trim().toUpperCase();
    return (
      assets.find(
        a =>
          a.qrCodeTag.toUpperCase() === cleanTag ||
          a.id.toUpperCase() === cleanTag ||
          a.name.toLowerCase().includes(tagOrId.toLowerCase())
      ) || null
    );
  }

  /**
   * Get all registered assets
   */
  static async getAllAssets(): Promise<MunicipalAsset[]> {
    const cached = await StorageService.getItem<MunicipalAsset[]>(ASSETS_CACHE_KEY);
    if (cached && cached.length > 0) return cached;

    // Nothing cached yet: seed from the bundled sample and keep it, so the
    // next call is a straight read. Deep-copied because the sample is a module
    // constant and callers mutate what they are given.
    const seeded: MunicipalAsset[] = JSON.parse(JSON.stringify(SAMPLE_ASSETS));
    await StorageService.setItem(ASSETS_CACHE_KEY, seeded);
    return seeded;
  }
}
