import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CommunityPost, NeighborhoodFeedFilter, CivicPollOption } from '../types/community.types';
import { CommunityService } from '../services/community.service';

interface CivicFeedContextType {
  posts: CommunityPost[];
  loading: boolean;
  filter: NeighborhoodFeedFilter;
  setFilter: (f: Partial<NeighborhoodFeedFilter>) => void;
  refreshFeed: () => Promise<void>;
  toggleUpvote: (postId: string) => Promise<void>;
  votePoll: (postId: string, optionId: string) => Promise<void>;
  createPost: (post: Parameters<typeof CommunityService.createPost>[0]) => Promise<CommunityPost>;
}

const defaultFilter: NeighborhoodFeedFilter = {
  category: 'ALL',
  sortBy: 'HOT',
  searchQuery: '',
};

const CivicFeedContext = createContext<CivicFeedContextType | null>(null);

export const CivicFeedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilterState] = useState<NeighborhoodFeedFilter>(defaultFilter);

  const refreshFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await CommunityService.getFeedPosts(filter);
      setPosts(data);
    } catch (err) {
      console.warn('[CivicFeedContext] Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  const setFilter = (newFilter: Partial<NeighborhoodFeedFilter>) => {
    setFilterState(prev => ({ ...prev, ...newFilter }));
  };

  const toggleUpvote = async (postId: string) => {
    try {
      const { hasUpvoted, newCount } = await CommunityService.toggleUpvotePost(postId);
      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, hasUpvoted, upvoteCount: newCount } : p))
      );
    } catch (err) {
      console.warn('[CivicFeedContext] Upvote error:', err);
    }
  };

  const votePoll = async (postId: string, optionId: string) => {
    try {
      const updatedOptions = await CommunityService.votePoll(postId, optionId);
      setPosts(prev =>
        prev.map(p =>
          p.id === postId && p.pollData
            ? {
                ...p,
                pollData: {
                  ...p.pollData,
                  hasVoted: true,
                  selectedOptionId: optionId,
                  totalVotes: p.pollData.totalVotes + 1,
                  options: updatedOptions,
                },
              }
            : p
        )
      );
    } catch (err) {
      console.warn('[CivicFeedContext] Poll error:', err);
    }
  };

  const createPost = async (post: Parameters<typeof CommunityService.createPost>[0]) => {
    const created = await CommunityService.createPost(post);
    setPosts(prev => [created, ...prev]);
    return created;
  };

  return (
    <CivicFeedContext.Provider
      value={{
        posts,
        loading,
        filter,
        setFilter,
        refreshFeed,
        toggleUpvote,
        votePoll,
        createPost,
      }}
    >
      {children}
    </CivicFeedContext.Provider>
  );
};

export const useCivicFeed = () => {
  const context = useContext(CivicFeedContext);
  if (!context) {
    throw new Error('useCivicFeed must be used within a CivicFeedProvider');
  }
  return context;
};
