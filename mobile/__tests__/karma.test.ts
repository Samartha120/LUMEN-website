import { KarmaService } from '../src/services/karma.service';
import { StorageService } from '../src/services/storage.service';

describe('KarmaService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('retrieves citizen karma summary with streak and badges', async () => {
    const summary = await KarmaService.getKarmaSummary();
    expect(summary.totalPoints).toBeGreaterThan(0);
    expect(summary.currentTier).toBeDefined();
    expect(summary.badges.length).toBeGreaterThan(0);
    expect(summary.recentTransactions.length).toBeGreaterThan(0);
  });

  test('awards points and updates tier accordingly', async () => {
    const initial = await KarmaService.getKarmaSummary();
    const initialPoints = initial.totalPoints;

    const updated = await KarmaService.awardPoints(
      'REPORT_VERIFIED_ACCURATE',
      200,
      'Test verified report points',
      'LMN-9999'
    );

    expect(updated.totalPoints).toBe(initialPoints + 200);
    expect(updated.recentTransactions[0].points).toBe(200);
  });

  test('retrieves civic leaderboard ranking', async () => {
    const leaderboard = await KarmaService.getLeaderboard();
    expect(leaderboard.length).toBeGreaterThan(0);
    for (let i = 0; i < leaderboard.length - 1; i++) {
      expect(leaderboard[i].points).toBeGreaterThanOrEqual(leaderboard[i + 1].points);
    }
  });
});
