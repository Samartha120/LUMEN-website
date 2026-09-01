import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { CommunityPost } from '../../types/community.types';
import { formatRelativeTime } from '../../utils/date';
import { formatCategoryName } from '../../utils/string';
import { HapticFeedback } from '../../utils/haptics';

export interface CommunityCardProps {
  post: CommunityPost;
  onPress?: () => void;
  onUpvote?: () => void;
  onComment?: () => void;
  onVotePoll?: (optionId: string) => void;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({
  post,
  onPress,
  onUpvote,
  onComment,
  onVotePoll,
}) => {
  const getBadgeTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM_GUARDIAN':
        return '#8B5CF6';
      case 'GOLD':
        return '#F59E0B';
      case 'SILVER':
        return '#64748B';
      default:
        return '#B45309';
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {/* Pinned / Announcement Header */}
      {post.isPinned && (
        <View style={styles.pinnedHeader}>
          <Icon name="pin" size={12} color={theme.colors.primary} />
          <Text style={styles.pinnedText}>Pinned Civic Notice</Text>
        </View>
      )}

      {/* Author Bar */}
      <View style={styles.authorRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{post.author.name.charAt(0)}</Text>
        </View>

        <View style={styles.authorMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName}>{post.author.name}</Text>
            {post.author.isVerifiedCitizen && (
              <Icon name="checkmark-circle" size={14} color={theme.colors.primary} />
            )}
          </View>

          <View style={styles.subAuthorRow}>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: getBadgeTierColor(post.author.karmaTier) },
              ]}
            >
              <Text style={styles.tierText}>
                {post.author.karmaTier === 'PLATINUM_GUARDIAN' ? 'Guardian' : post.author.karmaTier}
              </Text>
            </View>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.categoryTag}>
          <Text style={styles.categoryTagText}>{formatCategoryName(post.category)}</Text>
        </View>
      </View>

      {/* Title & Body */}
      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postBody}>{post.body}</Text>

      {/* Media Image */}
      {post.mediaUrls.length > 0 && (
        <Image source={{ uri: post.mediaUrls[0] }} style={styles.postImage} resizeMode="cover" />
      )}

      {/* Poll Component */}
      {post.pollData && (
        <View style={styles.pollContainer}>
          <Text style={styles.pollQuestion}>{post.pollData.question}</Text>
          {post.pollData.options.map(opt => {
            const isSelected = post.pollData?.selectedOptionId === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.pollOptionBtn,
                  isSelected && styles.pollOptionBtnSelected,
                ]}
                onPress={() => {
                  HapticFeedback.light();
                  onVotePoll?.(opt.id);
                }}
                disabled={post.pollData?.hasVoted}
                activeOpacity={0.7}
              >
                {/* Percentage progress bar */}
                {post.pollData?.hasVoted && (
                  <View
                    style={[
                      styles.pollProgressFill,
                      { width: `${opt.percentage}%` },
                      isSelected && styles.pollProgressFillSelected,
                    ]}
                  />
                )}
                <View style={styles.pollOptionContent}>
                  <Text
                    style={[
                      styles.pollOptionText,
                      isSelected && styles.pollOptionTextSelected,
                    ]}
                  >
                    {opt.text}
                  </Text>
                  {post.pollData?.hasVoted && (
                    <Text style={styles.pollPercentText}>{opt.percentage}%</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollFooter}>
            {post.pollData.totalVotes} votes • {post.pollData.hasVoted ? 'Voted' : 'Tap to vote'}
          </Text>
        </View>
      )}

      {/* Location Bar */}
      <View style={styles.locationRow}>
        <Icon name="location-outline" size={13} color={theme.colors.textMuted} />
        <Text style={styles.locationText}>{post.location.address}</Text>
      </View>

      {/* Engagement Actions */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={[styles.actionBtn, post.hasUpvoted && styles.actionBtnUpvoted]}
          onPress={() => {
            HapticFeedback.light();
            onUpvote?.();
          }}
        >
          <Icon
            name={post.hasUpvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
            size={18}
            color={post.hasUpvoted ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.actionCount,
              post.hasUpvoted && styles.actionCountUpvoted,
            ]}
          >
            {post.upvoteCount} Upvotes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <Icon name="chatbubble-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.actionCount}>{post.commentCount} Comments</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="share-social-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.actionCount}>Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  pinnedText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  authorMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  bulletDot: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  categoryTag: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  postTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  postBody: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  pollContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pollQuestion: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  pollOptionBtn: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  pollOptionBtnSelected: {
    borderColor: theme.colors.primary,
  },
  pollProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  pollProgressFillSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  pollOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  pollOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  pollPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  pollFooter: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: theme.spacing.sm,
  },
  locationText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
  },
  actionBtnUpvoted: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  actionCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  actionCountUpvoted: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
