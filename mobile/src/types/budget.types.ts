/**
 * Public civic budget allocations, expenditure tracking, and audit transparency types.
 * Note: Purely transparent public audit tracking; zero payment processing.
 */

import { CivicCategory } from './civic.types';

export interface ExpenditureProject {
  id: string;
  projectCode: string;
  title: string;
  category: CivicCategory;
  allocatedBudgetInr: number;
  spentToDateInr: number;
  contractorName: string;
  contractorRating: number; // 0.0 - 5.0
  startDate: string;
  targetCompletionDate: string;
  actualCompletionDate?: string;
  status: 'PLANNED' | 'TENDER_AWARDED' | 'IN_PROGRESS' | 'COMPLETED' | 'AUDITED';
  targetWard: string;
  auditNotes: string;
  citizenVerificationCount: number;
}

export interface WardBudgetAllocation {
  wardNumber: string;
  wardName: string;
  fiscalYear: string;
  totalBudgetInr: number;
  totalSpentInr: number;
  breakdownByCategory: Record<CivicCategory, { allocatedInr: number; spentInr: number; projectCount: number }>;
  activeProjects: ExpenditureProject[];
  transparencyScore: number; // 0 - 100
  lastAuditedDate: string;
}
