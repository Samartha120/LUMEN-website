import { CommunityService } from '../src/services/community.service';
import { StorageService } from '../src/services/storage.service';

describe('CommunityService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('retrieves initial feed posts successfully', async () => {
    const posts = await CommunityService.getFeedPosts();
    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0]).toHaveProperty('id');
    expect(posts[0]).toHaveProperty('title');
    expect(posts[0]).toHaveProperty('author');
  });

  test('filters posts by category', async () => {
    const roadPosts = await CommunityService.getFeedPosts({ category: 'roads', sortBy: 'HOT' });
    roadPosts.forEach(p => {
      expect(p.category).toBe('roads');
    });
  });

  test('filters posts by search query', async () => {
    const searchResults = await CommunityService.getFeedPosts({
      searchQuery: 'pothole',
      sortBy: 'NEW',
    });
    expect(searchResults.length).toBeGreaterThan(0);
    searchResults.forEach(p => {
      const match =
        p.title.toLowerCase().includes('pothole') ||
        p.body.toLowerCase().includes('pothole') ||
        p.tags.some(t => t.toLowerCase().includes('pothole'));
      expect(match).toBe(true);
    });
  });

  test('toggles upvote on a post accurately', async () => {
    const posts = await CommunityService.getFeedPosts();
    const targetPost = posts[0];
    const initialUpvotes = targetPost.upvoteCount;
    const initialHasUpvoted = targetPost.hasUpvoted;

    const { hasUpvoted, newCount } = await CommunityService.toggleUpvotePost(targetPost.id);

    expect(hasUpvoted).toBe(!initialHasUpvoted);
    if (!initialHasUpvoted) {
      expect(newCount).toBe(initialUpvotes + 1);
    } else {
      expect(newCount).toBe(initialUpvotes - 1);
    }
  });

  test('casts vote on a civic poll', async () => {
    const posts = await CommunityService.getFeedPosts();
    const pollPost = posts.find(p => p.type === 'CIVIC_POLL');
    expect(pollPost).toBeDefined();

    if (pollPost && pollPost.pollData) {
      const optionToVote = pollPost.pollData.options[0];
      const initialVotes = optionToVote.voteCount;

      const updatedOptions = await CommunityService.votePoll(pollPost.id, optionToVote.id);
      const votedOpt = updatedOptions.find(o => o.id === optionToVote.id);
      expect(votedOpt?.voteCount).toBe(initialVotes + 1);
    }
  });

  test('adds and retrieves threaded comments', async () => {
    const postId = 'post-101';
    const initialComments = await CommunityService.getComments(postId);

    const author = {
      id: 'test-user',
      name: 'Test Citizen',
      role: 'CITIZEN' as const,
      karmaTier: 'BRONZE' as const,
      karmaPoints: 100,
      isVerifiedCitizen: true,
    };

    const newComment = await CommunityService.addComment(
      postId,
      'This is a verified test comment regarding the repair.',
      author
    );

    expect(newComment.id).toBeDefined();
    expect(newComment.content).toBe('This is a verified test comment regarding the repair.');

    const updatedComments = await CommunityService.getComments(postId);
    expect(updatedComments.length).toBe(initialComments.length + 1);
  });
});
