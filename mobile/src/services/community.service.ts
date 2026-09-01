/**
 * Community service managing social interactions, discussions, upvoting, and civic threads.
 */

import { CommunityPost, CommunityComment, NeighborhoodFeedFilter, CivicPollOption } from '../types/community.types';
import { StorageService } from './storage.service';

const COMMUNITY_POSTS_CACHE_KEY = 'community_posts';
const COMMUNITY_COMMENTS_CACHE_KEY = 'community_comments';

const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post-101',
    type: 'ISSUE_REPORT',
    complaintId: 'cmp-001',
    author: {
      id: 'usr-1',
      name: 'Aarav Sharma',
      role: 'WARD_CHAMPION',
      karmaTier: 'GOLD',
      karmaPoints: 1280,
      badgeTitle: 'Pothole Patrol Master',
      isVerifiedCitizen: true,
    },
    title: 'Severe crater pothole near 8th Main Junction causing bike skids',
    body: 'Be careful while taking the left turn toward the metro station after dark. The water accumulation has obscured a deep 15cm pothole. Dispatched report already filed via LUMEN.',
    category: 'roads',
    mediaUrls: ['https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600'],
    location: {
      coordinate: { latitude: 12.9716, longitude: 77.5946 },
      address: '8th Main, 4th Block, Indiranagar',
      ward: 'Ward 112 - Domlur',
      city: 'Bengaluru',
    },
    upvoteCount: 42,
    downvoteCount: 1,
    hasUpvoted: true,
    commentCount: 14,
    shareCount: 9,
    viewCount: 312,
    isPinned: true,
    isResolved: false,
    tags: ['#Indiranagar', '#RoadSafety', '#PotholeAlert'],
    createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
  },
  {
    id: 'post-102',
    type: 'CIVIC_POLL',
    author: {
      id: 'usr-official',
      name: 'BBMP Public Works Dept',
      role: 'OFFICIAL',
      karmaTier: 'PLATINUM_GUARDIAN',
      karmaPoints: 5400,
      badgeTitle: 'Civic Authority Admin',
      isVerifiedCitizen: true,
    },
    title: 'Community Poll: Proposed Pedestrian Crossing & Speed Breaker on 100ft Road',
    body: 'Due to recent complaints regarding pedestrian safety near the central park entrance, we are considering adding an elevated zebra crossing with solar blinkers. Please vote on your preference.',
    category: 'public_property',
    mediaUrls: [],
    location: {
      coordinate: { latitude: 12.9780, longitude: 77.6400 },
      address: '100 Feet Road, HAL 2nd Stage',
      ward: 'Ward 112 - Domlur',
      city: 'Bengaluru',
    },
    upvoteCount: 89,
    downvoteCount: 3,
    commentCount: 32,
    shareCount: 27,
    viewCount: 940,
    isPinned: false,
    pollData: {
      id: 'poll-1',
      question: 'Which pedestrian safety measure do you support most?',
      options: [
        { id: 'opt-1', text: 'Elevated Table-top Crossing', voteCount: 142, percentage: 58 },
        { id: 'opt-2', text: 'Pedestrian Pelican Signal', voteCount: 68, percentage: 28 },
        { id: 'opt-3', text: 'Foot Over-Bridge with Elevator', voteCount: 34, percentage: 14 },
      ],
      totalVotes: 244,
      hasVoted: false,
      expiresAt: new Date(Date.now() + 86400 * 1000 * 5).toISOString(),
      isClosed: false,
    },
    tags: ['#PedestrianFirst', '#Ward112', '#CivicPoll'],
    createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
  },
];

const getFreshInitialComments = (): Record<string, CommunityComment[]> => ({
  'post-101': [
    {
      id: 'com-1',
      postId: 'post-101',
      author: {
        id: 'usr-2',
        name: 'Priya Venkatesh',
        role: 'CITIZEN',
        karmaTier: 'SILVER',
        karmaPoints: 460,
        isVerifiedCitizen: true,
      },
      content: 'Thanks for tagging this! Almost took a spill on my scooter here yesterday morning.',
      upvoteCount: 8,
      hasUpvoted: true,
      isOfficialResponse: false,
      createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    },
    {
      id: 'com-2',
      postId: 'post-101',
      author: {
        id: 'eng-1',
        name: 'Engineer Suresh Babu',
        role: 'ENGINEER',
        karmaTier: 'GOLD',
        karmaPoints: 2150,
        badgeTitle: 'Roads & Infra Field Unit 4',
        isVerifiedCitizen: true,
      },
      content: 'Field inspection completed. Cold-mix asphalt truck has been requisitioned.',
      upvoteCount: 26,
      hasUpvoted: false,
      isOfficialResponse: true,
      createdAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    },
  ],
});

export class CommunityService {
  /**
   * Fetch all feed posts filtered by category, search, sorting
   */
  static async getFeedPosts(filter?: NeighborhoodFeedFilter): Promise<CommunityPost[]> {
    const cached = await StorageService.getItem<CommunityPost[]>(COMMUNITY_POSTS_CACHE_KEY);
    let posts: CommunityPost[];
    if (cached && cached.length > 0) {
      posts = cached;
    } else {
      // Nothing cached yet: seed from the bundled sample and keep it. Deep-
      // copied because the sample is a module constant that callers mutate.
      posts = JSON.parse(JSON.stringify(INITIAL_COMMUNITY_POSTS));
      await StorageService.setItem(COMMUNITY_POSTS_CACHE_KEY, posts);
    }

    let result = [...posts];

    if (filter?.category && filter.category !== 'ALL') {
      result = result.filter(p => p.category === filter.category);
    }

    if (filter?.searchQuery && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.location.address.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (filter?.ward) {
      result = result.filter(p => p.location.ward === filter.ward);
    }

    if (filter?.onlyOfficialUpdates) {
      result = result.filter(p => p.type === 'OFFICIAL_ANNOUNCEMENT' || p.author.role === 'OFFICIAL');
    }

    if (filter?.sortBy === 'NEW') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (filter?.sortBy === 'TOP') {
      result.sort((a, b) => b.upvoteCount - a.upvoteCount);
    } else if (filter?.sortBy === 'HOT') {
      const hotScore = (p: CommunityPost) => {
        const ageHours = (Date.now() - new Date(p.createdAt).getTime()) / (3600 * 1000);
        return (p.upvoteCount * 2 + p.commentCount * 3) / Math.log10(ageHours + 2);
      };
      result.sort((a, b) => hotScore(b) - hotScore(a));
    }

    return result;
  }

  /**
   * Toggle upvote on a post
   */
  static async toggleUpvotePost(postId: string): Promise<{ hasUpvoted: boolean; newCount: number }> {
    const posts = await this.getFeedPosts();
    const target = posts.find(p => p.id === postId);
    if (!target) throw new Error('Post not found');

    if (target.hasUpvoted) {
      target.hasUpvoted = false;
      target.upvoteCount = Math.max(0, target.upvoteCount - 1);
    } else {
      target.hasUpvoted = true;
      target.upvoteCount += 1;
    }

    await StorageService.setItem(COMMUNITY_POSTS_CACHE_KEY, posts);
    return { hasUpvoted: target.hasUpvoted, newCount: target.upvoteCount };
  }

  /**
   * Cast a vote on a civic poll
   */
  static async votePoll(postId: string, optionId: string): Promise<CivicPollOption[]> {
    const posts = await this.getFeedPosts();
    const target = posts.find(p => p.id === postId);
    if (!target || !target.pollData) throw new Error('Poll not found');

    if (target.pollData.hasVoted) throw new Error('You have already voted in this poll');

    target.pollData.options = target.pollData.options.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, voteCount: opt.voteCount + 1 };
      }
      return opt;
    });

    target.pollData.totalVotes += 1;
    target.pollData.hasVoted = true;
    target.pollData.selectedOptionId = optionId;

    const total = target.pollData.totalVotes;
    target.pollData.options = target.pollData.options.map(opt => ({
      ...opt,
      percentage: Math.round((opt.voteCount / total) * 100),
    }));

    await StorageService.setItem(COMMUNITY_POSTS_CACHE_KEY, posts);
    return target.pollData.options;
  }

  /**
   * Fetch threaded comments for a post
   */
  static async getComments(postId: string): Promise<CommunityComment[]> {
    let allComments = await StorageService.getItem<Record<string, CommunityComment[]>>(COMMUNITY_COMMENTS_CACHE_KEY);
    if (!allComments) {
      allComments = getFreshInitialComments();
      await StorageService.setItem(COMMUNITY_COMMENTS_CACHE_KEY, allComments);
    }
    return allComments[postId] || [];
  }

  /**
   * Post a new comment
   */
  static async addComment(postId: string, content: string, author: CommunityComment['author']): Promise<CommunityComment> {
    let allComments = await StorageService.getItem<Record<string, CommunityComment[]>>(COMMUNITY_COMMENTS_CACHE_KEY);
    if (!allComments) {
      allComments = getFreshInitialComments();
    }

    const postComments = allComments[postId] ? [...allComments[postId]] : [];

    const newComment: CommunityComment = {
      id: `com-${Date.now()}`,
      postId,
      author,
      content,
      upvoteCount: 0,
      hasUpvoted: false,
      isOfficialResponse: author.role === 'OFFICIAL' || author.role === 'ENGINEER',
      createdAt: new Date().toISOString(),
    };

    postComments.push(newComment);
    allComments[postId] = postComments;
    await StorageService.setItem(COMMUNITY_COMMENTS_CACHE_KEY, allComments);

    const posts = await this.getFeedPosts();
    const target = posts.find(p => p.id === postId);
    if (target) {
      target.commentCount += 1;
      await StorageService.setItem(COMMUNITY_POSTS_CACHE_KEY, posts);
    }

    return newComment;
  }

  /**
   * Create a new community post
   */
  static async createPost(post: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'upvoteCount' | 'downvoteCount' | 'commentCount' | 'shareCount' | 'viewCount'>): Promise<CommunityPost> {
    const posts = await this.getFeedPosts();
    const newPost: CommunityPost = {
      ...post,
      id: `post-${Date.now()}`,
      upvoteCount: 1,
      downvoteCount: 0,
      hasUpvoted: true,
      commentCount: 0,
      shareCount: 0,
      viewCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    posts.unshift(newPost);
    await StorageService.setItem(COMMUNITY_POSTS_CACHE_KEY, posts);
    return newPost;
  }
}
