/**
 * Community engagement and social discussion types for LUMEN mobile application.
 */

import { CivicCategory, CivicLocation, GeoCoordinate } from './civic.types';

export type PostType = 'ISSUE_REPORT' | 'COMMUNITY_UPDATE' | 'CIVIC_POLL' | 'VOLUNTEER_DRIVE' | 'OFFICIAL_ANNOUNCEMENT';

export interface AuthorProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'CITIZEN' | 'WARD_CHAMPION' | 'OFFICIAL' | 'ENGINEER' | 'MODERATOR';
  karmaTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM_GUARDIAN';
  karmaPoints: number;
  badgeTitle?: string;
  isVerifiedCitizen: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  parentId?: string; // for nested replies
  author: AuthorProfile;
  content: string;
  attachments?: string[];
  upvoteCount: number;
  hasUpvoted?: boolean;
  isOfficialResponse: boolean;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  replyCount?: number;
}

export interface CommunityPost {
  id: string;
  type: PostType;
  complaintId?: string;
  author: AuthorProfile;
  title: string;
  body: string;
  category: CivicCategory;
  mediaUrls: string[];
  location: CivicLocation;
  upvoteCount: number;
  downvoteCount: number;
  hasUpvoted?: boolean;
  hasDownvoted?: boolean;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  isPinned: boolean;
  isResolved?: boolean;
  resolutionPhotoUrl?: string;
  tags: string[];
  pollData?: CivicPollData;
  createdAt: string;
  updatedAt: string;
}

export interface CivicPollOption {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
}

export interface CivicPollData {
  id: string;
  question: string;
  options: CivicPollOption[];
  totalVotes: number;
  hasVoted?: boolean;
  selectedOptionId?: string;
  expiresAt: string;
  isClosed: boolean;
}

export interface NeighborhoodFeedFilter {
  category?: CivicCategory | 'ALL';
  sortBy: 'HOT' | 'NEW' | 'TOP' | 'NEARBY' | 'RESOLVED';
  radiusKm?: number;
  userCoordinate?: GeoCoordinate;
  searchQuery?: string;
  ward?: string;
  onlyOfficialUpdates?: boolean;
}
