/**
 * Ward public budget transparency, civic fund expenditure tracking service.
 */

import { WardBudgetAllocation, ExpenditureProject } from '../types/budget.types';
import { StorageService } from './storage.service';

const BUDGET_CACHE_KEY = 'ward_budget_allocations';

const SAMPLE_WARD_BUDGET: WardBudgetAllocation = {
  wardNumber: 'Ward 112',
  wardName: 'Domlur / Indiranagar',
  fiscalYear: 'FY 2025-26',
  totalBudgetInr: 45000000, // 4.5 Crore INR
  totalSpentInr: 31200000, // 3.12 Crore INR (69.3% utilization)
  breakdownByCategory: {
    roads: { allocatedInr: 18000000, spentInr: 14200000, projectCount: 8 },
    water: { allocatedInr: 12000000, spentInr: 8900000, projectCount: 5 },
    waste: { allocatedInr: 6500000, spentInr: 4100000, projectCount: 4 },
    electrical: { allocatedInr: 5000000, spentInr: 2800000, projectCount: 3 },
    public_property: { allocatedInr: 3500000, spentInr: 1200000, projectCount: 2 },
  },
  transparencyScore: 94,
  lastAuditedDate: '2026-01-15',
  activeProjects: [
    {
      id: 'prj-101',
      projectCode: 'BBMP-RD-2025-W112-08',
      title: 'Resurfacing & Milling of 100ft Road HAL 2nd Stage (Km 0.0 to 2.4)',
      category: 'roads',
      allocatedBudgetInr: 8500000,
      spentToDateInr: 7200000,
      contractorName: 'Karnataka Infra Projects Private Ltd',
      contractorRating: 4.6,
      startDate: '2025-09-01',
      targetCompletionDate: '2026-03-31',
      status: 'IN_PROGRESS',
      targetWard: 'Ward 112',
      auditNotes: 'Bituminous concrete layer completed. Core samples passed density and compaction standards (98.2%).',
      citizenVerificationCount: 84,
    },
    {
      id: 'prj-102',
      projectCode: 'BWSSB-DRN-2025-W112-03',
      title: 'Stormwater Primary Canal RCC Lining & Desilting',
      category: 'water',
      allocatedBudgetInr: 4800000,
      spentToDateInr: 3900000,
      contractorName: 'Apex Civil Engineering Corp',
      contractorRating: 4.4,
      startDate: '2025-08-15',
      targetCompletionDate: '2026-02-28',
      status: 'IN_PROGRESS',
      targetWard: 'Ward 112',
      auditNotes: 'Precast slab installation 80% finished. Retaining wall reinforced with geo-textile filter.',
      citizenVerificationCount: 46,
    },
    {
      id: 'prj-103',
      projectCode: 'BESCOM-LED-2025-W112-01',
      title: 'Smart LED Streetlight Conversion (240 Poles)',
      category: 'electrical',
      allocatedBudgetInr: 2200000,
      spentToDateInr: 2200000,
      contractorName: 'Surya Smart Lighting Systems',
      contractorRating: 4.9,
      startDate: '2025-06-01',
      targetCompletionDate: '2025-11-30',
      actualCompletionDate: '2025-11-25',
      status: 'COMPLETED',
      targetWard: 'Ward 112',
      auditNotes: 'All 240 energy-efficient fixtures commissioned with automated feeder telemetry.',
      citizenVerificationCount: 128,
    },
  ],
};

export class BudgetService {
  /**
   * Get public ward budget and expenditure transparency breakdown
   */
  static async getWardBudget(wardNumber: string = 'Ward 112'): Promise<WardBudgetAllocation> {
    const cached = await StorageService.getItem<WardBudgetAllocation>(BUDGET_CACHE_KEY);
    if (cached) return cached;
    await StorageService.setItem(BUDGET_CACHE_KEY, SAMPLE_WARD_BUDGET);
    return SAMPLE_WARD_BUDGET;
  }

  /**
   * Add citizen audit verification note on a public project
   */
  static async verifyProject(projectId: string): Promise<ExpenditureProject | null> {
    const budget = await this.getWardBudget();
    const proj = budget.activeProjects.find(p => p.id === projectId);
    if (proj) {
      proj.citizenVerificationCount += 1;
      await StorageService.setItem(BUDGET_CACHE_KEY, budget);
      return proj;
    }
    return null;
  }
}
