import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { useCivicFeed } from '../state/CivicFeedContext';
import { CommunityCard } from '../components/CommunityCard';
import { FilterPill } from '../components/FilterPill';
import { SearchBar } from '../components/SearchBar';
import { BottomSheet } from '../components/BottomSheet';
import { CommentList } from '../components/CommentList';
import { CommunityPost, CommunityComment } from '../types/community.types';
import { CommunityService } from '../services/community.service';
import { HapticFeedback } from '../utils/haptics';

const CATEGORY_FILTER_OPTIONS = [
  { id: 'ALL', label: 'All Updates', icon: 'grid-outline' },
  { id: 'roads', label: 'Roads', icon: 'construct-outline' },
  { id: 'electrical', label: 'Electrical', icon: 'flash-outline' },
  { id: 'water', label: 'Water & Drains', icon: 'water-outline' },
  { id: 'waste', label: 'Sanitation', icon: 'trash-outline' },
  { id: 'public_property', label: 'Public Assets', icon: 'business-outline' },
];

const SORT_OPTIONS = [
  { id: 'HOT', label: '🔥 Trending' },
  { id: 'NEW', label: '⏱️ Latest' },
  { id: 'TOP', label: '⭐ Top Voted' },
];

export const CommunityFeedScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { posts, loading, filter, setFilter, refreshFeed, toggleUpvote, votePoll, createPost } =
    useCivicFeed();

  const [selectedPostForComments, setSelectedPostForComments] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [isNewPostModalVisible, setIsNewPostModalVisible] = useState(false);

  // New Post Form State
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState<'roads' | 'electrical' | 'waste' | 'water' | 'public_property'>('roads');

  const openComments = async (post: CommunityPost) => {
    HapticFeedback.light();
    setSelectedPostForComments(post);
    const list = await CommunityService.getComments(post.id);
    setComments(list);
  };

  const handleAddComment = async (content: string) => {
    if (!selectedPostForComments) return;
    const author: CommunityComment['author'] = {
      id: 'current-user',
      name: 'Vedant Nair (You)',
      role: 'CITIZEN',
      karmaTier: 'GOLD',
      karmaPoints: 1780,
      isVerifiedCitizen: true,
    };
    const newCom = await CommunityService.addComment(selectedPostForComments.id, content, author);
    setComments(prev => [...prev, newCom]);
  };

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    HapticFeedback.success();

    await createPost({
      type: 'COMMUNITY_UPDATE',
      // A new post is never pinned: pinning is something a moderator does to
      // an existing post, not a property the author can set.
      isPinned: false,
      author: {
        id: 'current-user',
        name: 'Vedant Nair (You)',
        role: 'CITIZEN',
        karmaTier: 'GOLD',
        karmaPoints: 1780,
        badgeTitle: 'Active Resident',
        isVerifiedCitizen: true,
      },
      title: newTitle.trim(),
      body: newBody.trim(),
      category: newCategory,
      mediaUrls: [],
      location: {
        coordinate: { latitude: 12.9716, longitude: 77.5946 },
        address: 'Indiranagar, Bengaluru',
        ward: 'Ward 112 - Domlur',
      },
      tags: ['#CommunityUpdate', `#${newCategory}`],
    });

    setNewTitle('');
    setNewBody('');
    setIsNewPostModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <SearchBar
        value={filter.searchQuery || ''}
        onChangeText={text => setFilter({ searchQuery: text })}
        placeholder="Search posts, wards, topics..."
      />

      {/* Category filter ribbon */}
      <FilterPill
        options={CATEGORY_FILTER_OPTIONS}
        selectedId={filter.category || 'ALL'}
        onSelect={catId => setFilter({ category: catId as any })}
      />

      {/* Sort options bar */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Feed Stream:</Text>
        <View style={styles.sortPillsRow}>
          {SORT_OPTIONS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.sortPill, filter.sortBy === s.id && styles.sortPillActive]}
              onPress={() => {
                HapticFeedback.light();
                setFilter({ sortBy: s.id as any });
              }}
            >
              <Text
                style={[
                  styles.sortPillText,
                  filter.sortBy === s.id && styles.sortPillTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Feed list */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshFeed} />}
      >
        {posts.map(post => (
          <CommunityCard
            key={post.id}
            post={post}
            onPress={() => openComments(post)}
            onUpvote={() => toggleUpvote(post.id)}
            onComment={() => openComments(post)}
            onVotePoll={optId => votePoll(post.id, optId)}
          />
        ))}

        {posts.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Icon name="chatbubbles-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No community posts found</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to share an update or question in your neighborhood!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating New Post FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          HapticFeedback.medium();
          setIsNewPostModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Icon name="add" size={24} color="#FFFFFF" />
        <Text style={styles.fabText}>New Post</Text>
      </TouchableOpacity>

      {/* Threaded comments bottom sheet */}
      <BottomSheet
        visible={!!selectedPostForComments}
        onClose={() => setSelectedPostForComments(null)}
        title={selectedPostForComments?.title}
      >
        <CommentList comments={comments} onAddComment={handleAddComment} />
      </BottomSheet>

      {/* Create new post modal */}
      <Modal
        visible={isNewPostModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsNewPostModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Community Update</Text>
              <TouchableOpacity
                onPress={() => setIsNewPostModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Icon name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.titleInput}
              placeholder="Headline / Question"
              placeholderTextColor={theme.colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TextInput
              style={styles.bodyInput}
              placeholder="Detailed description, landmark, advice for neighbors..."
              placeholderTextColor={theme.colors.textMuted}
              value={newBody}
              onChangeText={setNewBody}
              multiline
            />

            <View style={styles.categorySelector}>
              <Text style={styles.catLabel}>Category:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {(['roads', 'electrical', 'waste', 'water', 'public_property'] as const).map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catOption, newCategory === cat && styles.catOptionActive]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text style={[styles.catText, newCategory === cat && styles.catTextActive]}>
                      {cat.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[
                styles.publishBtn,
                (!newTitle.trim() || !newBody.trim()) && styles.publishBtnDisabled,
              ]}
              onPress={handleCreatePost}
              disabled={!newTitle.trim() || !newBody.trim()}
            >
              <Text style={styles.publishBtnText}>Publish to Neighborhood Feed</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    gap: 8,
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  sortPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sortPillActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: theme.colors.primary,
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  sortPillTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  feedContent: {
    padding: theme.spacing.md,
    paddingBottom: 90,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  titleInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 12,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bodyInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 12,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categorySelector: {
    marginBottom: theme.spacing.lg,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  catOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
  },
  catOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  catText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  catTextActive: {
    color: '#FFFFFF',
  },
  publishBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  publishBtnDisabled: {
    backgroundColor: theme.colors.border,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
});
