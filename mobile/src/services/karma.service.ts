/**
 * Civic Karma & Recognition points engine (gamification without payments).
 */

import { CitizenKarmaSummary, KarmaBadge, KarmaTransaction, LeaderboardEntry, KarmaTier } from '../types/karma.types';
import { StorageService } from './storage.service';

const KARMA_SUMMARY_CACHE_KEY = 'citizen_karma_summary';
const LEADERBOARD_CACHE_KEY = 'civic_leaderboard';

const DEFAULT_BADGES: KarmaBadge[] = [
  {
    id: 'bdg-1',
    code: 'FIRST_RESPONDER',
    name: 'First Responder',
    description: 'Submitted your first verified civic damage report with high AI confidence.',
    iconName: 'flag',
    tier: 'BRONZE',
    category: 'REPORTING',
    pointsReward: 50,
    isUnlocked: true,
    unlockedAt: new Date(Date.now() - 86400 * 1000 * 14).toISOString(),
    progressPercent: 100,
    criteriaDescription: 'Report 1 issue that gets verified by the department',
  },
  {
    id: 'bdg-2',
    code: 'POTHOLE_PATROL',
    name: 'Pothole Patrol Master',
    description: 'Reported 10 verified road hazards that resulted in timely repair dispatches.',
    iconName: 'construct',
    tier: 'SILVER',
    category: 'REPORTING',
    pointsReward: 250,
    isUnlocked: true,
    unlockedAt: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
    progressPercent: 100,
    criteriaDescription: 'Report 10 verified road damage incidents',
  },
  {
    id: 'bdg-3',
    code: 'COMMUNITY_VOICE',
    name: 'Community Voice Champion',
    description: 'Contributed 25 helpful comments and civic poll votes in your neighborhood.',
    iconName: 'chatbubbles',
    tier: 'GOLD',
    category: 'COMMUNITY',
    pointsReward: 500,
    isUnlocked: false,
    progressPercent: 68,
    criteriaDescription: '25 community upvotes or constructive discussions',
  },
  {
    id: 'bdg-4',
    code: 'SAFETY_GUARDIAN',
    name: 'Ward Safety Sentinel',
    description: 'Identified a life-threatening electrical or open manhole emergency hazard.',
    iconName: 'shield-checkmark',
    tier: 'PLATINUM_GUARDIAN',
    category: 'SPECIAL_EVENT',
    pointsReward: 1000,
    isUnlocked: true,
    unlockedAt: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
    progressPercent: 100,
    criteriaDescription: 'Report a critical emergency hazard that gets verified',
  },
  {
    id: 'bdg-5',
    code: 'CIVIC_STREAK_30',
    name: '30-Day Active Citizen',
    description: 'Maintained a 30-day continuous active contribution streak.',
    iconName: 'flame',
    tier: 'GOLD',
    category: 'STREAK',
    pointsReward: 750,
    isUnlocked: false,
    progressPercent: 40,
    criteriaDescription: 'Check-in or contribute for 30 consecutive days',
  },
];

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    citizenId: 'usr-top1',
    name: 'Dr. Ananya Murthy',
    wardName: 'Ward 80 - Koramangala',
    points: 3420,
    tier: 'PLATINUM_GUARDIAN',
    resolvedCount: 48,
    badgeCount: 9,
  },
  {
    rank: 2,
    citizenId: 'usr-top2',
    name: 'Karthik Ramanathan',
    wardName: 'Ward 112 - Domlur',
    points: 2890,
    tier: 'PLATINUM_GUARDIAN',
    resolvedCount: 36,
    badgeCount: 7,
  },
  {
    rank: 3,
    citizenId: 'current-user',
    name: 'Vedant Nair (You)',
    wardName: 'Ward 112 - Domlur',
    points: 1780,
    tier: 'GOLD',
    resolvedCount: 19,
    badgeCount: 4,
    isCurrentUser: true,
  },
  {
    rank: 4,
    citizenId: 'usr-top4',
    name: 'Pooja Hegde',
    wardName: 'Ward 117 - Shanthi Nagar',
    points: 1540,
    tier: 'GOLD',
    resolvedCount: 15,
    badgeCount: 5,
  },
  {
    rank: 5,
    citizenId: 'usr-top5',
    name: 'Rajesh Gopinath',
    wardName: 'Ward 150 - Bellandur',
    points: 1120,
    tier: 'SILVER',
    resolvedCount: 11,
    badgeCount: 3,
  },
];

export class KarmaService {
  /**
   * Get citizen karma profile summary
   */
  static async getKarmaSummary(): Promise<CitizenKarmaSummary> {
    const cached = await StorageService.getItem<CitizenKarmaSummary>(KARMA_SUMMARY_CACHE_KEY);
    if (cached) return cached;

    const summary: CitizenKarmaSummary = {
      citizenId: 'current-user',
      totalPoints: 1780,
      currentTier: 'GOLD',
      nextTierPointsNeeded: 720, // 2500 for Platinum Guardian
      currentStreakDays: 12,
      longestStreakDays: 18,
      verifiedReportsCount: 19,
      resolvedIssuesImpacted: 14,
      communityHelpfulUpvotes: 84,
      neighborhoodRank: 3,
      cityRank: 42,
      badges: DEFAULT_BADGES,
      recentTransactions: [
        {
          id: 'tx-1',
          citizenId: 'current-user',
          points: 1000,
          actionType: 'BADGE_UNLOCKED',
          description: 'Unlocked Ward Safety Sentinel badge',
          timestamp: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
        },
        {
          id: 'tx-2',
          citizenId: 'current-user',
          points: 100,
          actionType: 'REPORT_VERIFIED_ACCURATE',
          description: 'Pothole report #LMN-8021 verified by department',
          relatedTicketNumber: 'LMN-8021',
          timestamp: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
        },
        {
          id: 'tx-3',
          citizenId: 'current-user',
          points: 30,
          actionType: 'COMMUNITY_UPVOTE_RECEIVED',
          description: 'Received 10 upvotes on 8th Main road update',
          timestamp: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
        },
      ],
    };

    await StorageService.setItem(KARMA_SUMMARY_CACHE_KEY, summary);
    return summary;
  }

  /**
   * Award karma points for a citizen action
   */
  static async awardPoints(actionType: KarmaTransaction['actionType'], points: number, description: string, ticketNumber?: string): Promise<CitizenKarmaSummary> {
    const summary = await this.getKarmaSummary();
    summary.totalPoints += points;

    const newTx: KarmaTransaction = {
      id: `tx-${Date.now()}`,
      citizenId: summary.citizenId,
      points,
      actionType,
      description,
      relatedTicketNumber: ticketNumber,
      timestamp: new Date().toISOString(),
    };

    summary.recentTransactions.unshift(newTx);

    // Re-evaluate tier
    if (summary.totalPoints >= 2500) {
      summary.currentTier = 'PLATINUM_GUARDIAN';
      summary.nextTierPointsNeeded = 0;
    } else if (summary.totalPoints >= 1000) {
      summary.currentTier = 'GOLD';
      summary.nextTierPointsNeeded = 2500 - summary.totalPoints;
    } else if (summary.totalPoints >= 300) {
      summary.currentTier = 'SILVER';
      summary.nextTierPointsNeeded = 1000 - summary.totalPoints;
    }

    await StorageService.setItem(KARMA_SUMMARY_CACHE_KEY, summary);
    return summary;
  }

  /**
   * Get ward and city-wide leaderboards
   */
  static async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const cached = await StorageService.getItem<LeaderboardEntry[]>(LEADERBOARD_CACHE_KEY);
    if (cached) return cached;

    await StorageService.setItem(LEADERBOARD_CACHE_KEY, INITIAL_LEADERBOARD);
    return INITIAL_LEADERBOARD;
  }
}
