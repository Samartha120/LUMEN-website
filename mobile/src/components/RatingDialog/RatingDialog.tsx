import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { HapticFeedback } from '../../utils/haptics';

export interface RatingDialogProps {
  visible: boolean;
  ticketNumber: string;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string, tags: string[]) => void;
}

const FEEDBACK_TAGS = [
  'Prompt Resolution',
  'High Quality Work',
  'Clean Site Clearance',
  'Helpful Engineer',
  'Clear Communication',
  'Needs Better Finish',
];

export const RatingDialog: React.FC<RatingDialogProps> = ({
  visible,
  ticketNumber,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Prompt Resolution', 'High Quality Work']);

  const toggleTag = (tag: string) => {
    HapticFeedback.light();
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleStarPress = (starIndex: number) => {
    HapticFeedback.medium();
    setRating(starIndex);
  };

  const handleSubmit = () => {
    HapticFeedback.success();
    onSubmit(rating, feedback, selectedTags);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Rate Civic Resolution</Text>
          <Text style={styles.subtitle}>
            How satisfied are you with the repair on #{ticketNumber}?
          </Text>

          {/* Star rating row */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                activeOpacity={0.7}
              >
                <Icon
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= rating ? '#F59E0B' : theme.colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick tags */}
          <View style={styles.tagsGrid}>
            {FEEDBACK_TAGS.map(tag => {
              const isSelected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional remarks */}
          <TextInput
            style={styles.textInput}
            placeholder="Add optional notes for the department supervisor..."
            placeholderTextColor={theme.colors.textMuted}
            value={feedback}
            onChangeText={setFeedback}
            multiline
          />

          {/* Actions */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>Submit Rating</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  dialog: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagPillSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: theme.colors.primary,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tagTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 10,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  submitBtnText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
