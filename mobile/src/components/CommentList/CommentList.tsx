import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { CommunityComment } from '../../types/community.types';
import { formatRelativeTime } from '../../utils/date';
import { HapticFeedback } from '../../utils/haptics';

export interface CommentListProps {
  comments: CommunityComment[];
  onAddComment: (content: string) => void;
}

export const CommentList: React.FC<CommentListProps> = ({ comments, onAddComment }) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    HapticFeedback.light();
    onAddComment(inputText.trim());
    setInputText('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Community Discussion ({comments.length})</Text>

      {/* Input box */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a constructive community comment..."
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Icon name="send" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Comments items */}
      {comments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No comments yet. Start the neighborhood conversation!</Text>
        </View>
      ) : (
        comments.map(c => (
          <View
            key={c.id}
            style={[styles.commentItem, c.isOfficialResponse && styles.commentOfficial]}
          >
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.author.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameBadgeRow}>
                  <Text style={styles.authorName}>{c.author.name}</Text>
                  {c.isOfficialResponse && (
                    <View style={styles.officialBadge}>
                      <Text style={styles.officialBadgeText}>Official Action</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.timeText}>{formatRelativeTime(c.createdAt)}</Text>
              </View>
            </View>

            <Text style={styles.commentBody}>{c.content}</Text>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 8,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: theme.colors.border,
  },
  emptyState: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  commentItem: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  commentOfficial: {
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
    borderColor: theme.colors.primary,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  officialBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  officialBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  commentBody: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    lineHeight: 18,
  },
});
