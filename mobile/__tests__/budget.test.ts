import { BudgetService } from '../src/services/budget.service';
import { StorageService } from '../src/services/storage.service';

describe('BudgetService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('retrieves ward budget allocations and active capital works', async () => {
    const budget = await BudgetService.getWardBudget('Ward 112');
    expect(budget.totalBudgetInr).toBeGreaterThan(0);
    expect(budget.totalSpentInr).toBeLessThanOrEqual(budget.totalBudgetInr);
    expect(budget.activeProjects.length).toBeGreaterThan(0);
  });

  test('increments citizen audit verification count on a project', async () => {
    const budget = await BudgetService.getWardBudget('Ward 112');
    const project = budget.activeProjects[0];
    const initialVerifications = project.citizenVerificationCount;

    const updated = await BudgetService.verifyProject(project.id);
    expect(updated?.citizenVerificationCount).toBe(initialVerifications + 1);
  });
});
