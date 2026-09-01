/**
 * Civic Karma points, badges, and recognition tier types.
 * Note: Purely gamified civic recognition; no monetary or payment flows.
 */

export type KarmaTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM_GUARDIAN';

export interface KarmaBadge {
  id: string;
  code: string;
  name: string;
  description: string;
  iconName: string;
  tier: KarmaTier;
  category: 'REPORTING' | 'COMMUNITY' | 'VERIFICATION' | 'STREAK' | 'SPECIAL_EVENT';
  pointsReward: number;
  unlockedAt?: string;
  isUnlocked: boolean;
  progressPercent: number; // 0 - 100
  criteriaDescription: string;
}

export interface KarmaTransaction {
  id: string;
  citizenId: string;
  points: number;
  actionType:
    | 'REPORT_SUBMITTED'
    | 'REPORT_VERIFIED_ACCURATE'
    | 'ISSUE_RESOLVED'
    | 'COMMUNITY_UPVOTE_RECEIVED'
    | 'HELPFUL_COMMENT'
    | 'HAZARD_ALERT_BROADCAST_CONFIRMED'
    | 'STREAK_BONUS'
    | 'BADGE_UNLOCKED';
  description: string;
  relatedTicketNumber?: string;
  timestamp: string;
}

export interface CitizenKarmaSummary {
  citizenId: string;
  totalPoints: number;
  currentTier: KarmaTier;
  nextTierPointsNeeded: number;
  currentStreakDays: number;
  longestStreakDays: number;
  verifiedReportsCount: number;
  resolvedIssuesImpacted: number;
  communityHelpfulUpvotes: number;
  neighborhoodRank: number;
  cityRank: number;
  badges: KarmaBadge[];
  recentTransactions: KarmaTransaction[];
}

export interface LeaderboardEntry {
  rank: number;
  citizenId: string;
  name: string;
  avatarUrl?: string;
  wardName: string;
  points: number;
  tier: KarmaTier;
  resolvedCount: number;
  badgeCount: number;
  isCurrentUser?: boolean;
}
