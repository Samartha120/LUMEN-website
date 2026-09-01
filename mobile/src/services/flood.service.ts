/**
 * Flood monitoring, stormwater drain telemetry, and water level warning service.
 */

import { FloodAlertPerimeter, StormwaterSensor, WaterLevelStatus } from '../types/flood.types';
import { StorageService } from './storage.service';

const FLOOD_CACHE_KEY = 'flood_monitor_telemetry';

const SAMPLE_SENSORS: StormwaterSensor[] = [
  {
    sensorId: 'sns-swd-01',
    locationName: 'Indiranagar 100ft Road SWD Culvert',
    coordinate: { latitude: 12.9780, longitude: 77.6400 },
    sensorType: 'DRAIN_DEPTH',
    currentDepthMeters: 1.2,
    maxCapacityMeters: 3.5,
    capacityUtilizationPercentage: 34,
    status: 'NORMAL',
    rateOfRiseCmPerHour: 2.5,
    rainfallLast24HoursMm: 14.2,
    lastUpdated: new Date().toISOString(),
    isDesiltingRequired: false,
    pumpStationActive: false,
  },
  {
    sensorId: 'sns-swd-02',
    locationName: 'Bellandur Lake Inflow Channel #4',
    coordinate: { latitude: 12.9352, longitude: 77.6245 },
    sensorType: 'LAKE_INFLOW',
    currentDepthMeters: 3.8,
    maxCapacityMeters: 4.2,
    capacityUtilizationPercentage: 90,
    status: 'WARNING',
    rateOfRiseCmPerHour: 18.0,
    rainfallLast24HoursMm: 42.6,
    lastUpdated: new Date().toISOString(),
    isDesiltingRequired: true,
    pumpStationActive: true,
  },
  {
    sensorId: 'sns-swd-03',
    locationName: 'Shanthi Nagar 12th Cross Low-Lying Underpass',
    coordinate: { latitude: 12.9740, longitude: 77.5990 },
    sensorType: 'ROAD_SUBMERSION',
    currentDepthMeters: 0.25,
    maxCapacityMeters: 0.5,
    capacityUtilizationPercentage: 50,
    status: 'ELEVATED',
    rateOfRiseCmPerHour: 6.0,
    rainfallLast24HoursMm: 22.0,
    lastUpdated: new Date().toISOString(),
    isDesiltingRequired: false,
    pumpStationActive: true,
  },
];

export class FloodService {
  /**
   * Get live stormwater sensor telemetry readings
   */
  static async getSensors(): Promise<StormwaterSensor[]> {
    const cached = await StorageService.getItem<StormwaterSensor[]>(FLOOD_CACHE_KEY);
    if (cached && cached.length > 0) return cached;

    // Nothing cached yet: seed from the bundled sample and keep it, so the
    // next call is a straight read. Deep-copied because the sample is a module
    // constant and callers mutate what they are given.
    const seeded: StormwaterSensor[] = JSON.parse(JSON.stringify(SAMPLE_SENSORS));
    await StorageService.setItem(FLOOD_CACHE_KEY, seeded);
    return seeded;
  }

  /**
   * Get active flood perimeters & evacuation shelters
   */
  static async getFloodPerimeters(): Promise<FloodAlertPerimeter[]> {
    const sensors = await this.getSensors();
    return [
      {
        id: 'perim-1',
        zoneName: 'Bellandur Basin Flood Vulnerability Zone',
        status: 'WARNING',
        affectedStreets: ['Outer Ring Road Low Point', 'EcoSpace Underpass', 'Yemalur Main Road'],
        recommendedEvacuationRoutes: ['HAL Old Airport Road Corridor', 'Sarjapur Elevated Highway'],
        safeShelters: [
          { name: 'HAL Community Hall', address: 'Suranjandas Road', capacity: 350 },
          { name: 'Government PU College Auditorium', address: 'Domlur Layout', capacity: 500 },
        ],
        sensors: sensors.filter(s => s.status === 'WARNING' || s.status === 'OVERFLOW_DANGER'),
        lastAssessedAt: new Date().toISOString(),
      },
    ];
  }
}
