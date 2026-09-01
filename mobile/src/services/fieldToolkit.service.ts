/**
 * Field engineering repair dimension calculations and material requisition estimator.
 */

import { MaterialCalculationResult, RepairDimensionInput } from '../types/fieldToolkit.types';

// Standard civil engineering constants
const ASPHALT_DENSITY_TONS_PER_CUBIC_METER = 2.35; // Compacted bituminous concrete
const TACK_COAT_APPLICATION_RATE_LITRES_PER_SQM = 0.5; // RS-1 Bitumen Emulsion
const AGGREGATE_BASE_DENSITY_TONS_PER_CUBIC_METER = 2.1; // WMM / GSB base course
const COMPACTION_SURCHARGE_FACTOR = 1.18; // 18% compaction loss compensation

export class FieldToolkitService {
  /**
   * Calculate exact engineering material quantities and equipment requirements
   */
  static calculateRepairMaterials(input: RepairDimensionInput): MaterialCalculationResult {
    const length = Math.max(0.1, input.lengthMeters);
    const width = Math.max(0.1, input.widthMeters);
    const depthCm = Math.max(1, input.depthCentimeters);
    const depthMeters = depthCm / 100;

    const surfaceAreaSqm = Math.round(length * width * 100) / 100;
    const excavationVolumeCubicMeters = Math.round(surfaceAreaSqm * depthMeters * 100) / 100;

    // Surcharge for heavy traffic arterial roads
    const trafficMultiplier = input.roadType === 'ARTERIAL_HEAVY_TRAFFIC' ? 1.15 : 1.0;

    const asphaltVolumeCubicMeters = excavationVolumeCubicMeters * COMPACTION_SURCHARGE_FACTOR * trafficMultiplier;
    const asphaltTonnageRequired = Math.round(asphaltVolumeCubicMeters * ASPHALT_DENSITY_TONS_PER_CUBIC_METER * 100) / 100;

    const tackCoatLitresRequired = Math.round((surfaceAreaSqm + 2 * (length + width) * depthMeters) * TACK_COAT_APPLICATION_RATE_LITRES_PER_SQM * 10) / 10;

    let aggregateTonnageRequired = 0;
    if (input.subBaseCondition !== 'SOLID' || depthCm > 12) {
      const baseDepthMeters = 0.15; // 150mm sub-base replacement
      aggregateTonnageRequired = Math.round(surfaceAreaSqm * baseDepthMeters * AGGREGATE_BASE_DENSITY_TONS_PER_CUBIC_METER * 100) / 100;
    }

    const estimatedCrewHours = Math.round(Math.max(1.5, surfaceAreaSqm * 0.4 + (depthCm > 10 ? 1 : 0)) * 10) / 10;
    const recommendedCuringHours = input.roadType === 'ARTERIAL_HEAVY_TRAFFIC' ? 6 : 3;

    return {
      surfaceAreaSqm,
      excavationVolumeCubicMeters,
      asphaltTonnageRequired,
      tackCoatLitresRequired,
      aggregateTonnageRequired,
      estimatedCrewHours,
      recommendedCuringHours,
      materialBreakdown: [
        {
          materialType: 'HOT_MIX_ASPHALT',
          materialName: 'Bituminous Concrete Hot Mix (Grade 2)',
          quantity: asphaltTonnageRequired,
          unit: 'TONS',
          estimatedCostInr: Math.round(asphaltTonnageRequired * 5200),
          inventoryStockStatus: 'IN_STOCK',
        },
        {
          materialType: 'BITUMEN_EMULSION_TACK_COAT',
          materialName: 'Rapid Setting Tack Coat (RS-1)',
          quantity: tackCoatLitresRequired,
          unit: 'LITRES',
          estimatedCostInr: Math.round(tackCoatLitresRequired * 65),
          inventoryStockStatus: 'IN_STOCK',
        },
        ...(aggregateTonnageRequired > 0
          ? [
              {
                materialType: 'GRANULAR_SUB_BASE_AGGREGATE' as const,
                materialName: 'Graded Crushed Stone Aggregate (40mm)',
                quantity: aggregateTonnageRequired,
                unit: 'TONS' as const,
                estimatedCostInr: Math.round(aggregateTonnageRequired * 850),
                inventoryStockStatus: 'IN_STOCK' as const,
              },
            ]
          : []),
      ],
    };
  }
}
