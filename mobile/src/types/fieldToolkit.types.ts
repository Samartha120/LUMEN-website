/**
 * Field engineering calculation, material estimation, and rate card types.
 */

export type RepairMaterialType =
  | 'COLD_MIX_ASPHALT'
  | 'HOT_MIX_ASPHALT'
  | 'BITUMEN_EMULSION_TACK_COAT'
  | 'GRANULAR_SUB_BASE_AGGREGATE'
  | 'PRECAST_CONCRETE_MANHOLE_COVER'
  | 'PAVER_BLOCKS_INTERLOCKING'
  | 'LED_STREETLIGHT_FIXTURE_60W';

export interface MaterialRequirement {
  materialType: RepairMaterialType;
  materialName: string;
  quantity: number;
  unit: 'TONS' | 'KG' | 'LITRES' | 'CUBIC_METERS' | 'UNITS';
  estimatedCostInr: number;
  inventoryStockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'REQUISITION_REQUIRED';
}

export interface RepairDimensionInput {
  lengthMeters: number;
  widthMeters: number;
  depthCentimeters: number;
  roadType: 'ARTERIAL_HEAVY_TRAFFIC' | 'RESIDENTIAL_LOCAL' | 'FOOTPATH_PEDESTRIAN';
  subBaseCondition: 'SOLID' | 'SUBSIDED' | 'WATERLOGGED';
}

export interface MaterialCalculationResult {
  surfaceAreaSqm: number;
  excavationVolumeCubicMeters: number;
  asphaltTonnageRequired: number;
  tackCoatLitresRequired: number;
  aggregateTonnageRequired: number;
  estimatedCrewHours: number;
  recommendedCuringHours: number;
  materialBreakdown: MaterialRequirement[];
}
