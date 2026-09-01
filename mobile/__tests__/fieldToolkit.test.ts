import { FieldToolkitService } from '../src/services/fieldToolkit.service';

describe('FieldToolkitService Tests', () => {
  test('calculates accurate asphalt tonnage and excavation quantities', () => {
    const result = FieldToolkitService.calculateRepairMaterials({
      lengthMeters: 2.0,
      widthMeters: 1.5,
      depthCentimeters: 10,
      roadType: 'RESIDENTIAL_LOCAL',
      subBaseCondition: 'SOLID',
    });

    expect(result.surfaceAreaSqm).toBe(3.0);
    expect(result.excavationVolumeCubicMeters).toBe(0.3);
    expect(result.asphaltTonnageRequired).toBeGreaterThan(0.7);
    expect(result.tackCoatLitresRequired).toBeGreaterThan(1.5);
    expect(result.materialBreakdown.length).toBeGreaterThanOrEqual(2);
  });
});
