import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { MilestoneUpdate } from '../../types/tracking.types';
import { formatRelativeTime } from '../../utils/date';

export interface TimelineProps {
  milestones: MilestoneUpdate[];
  onPressProofPhoto?: (photoUrl: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ milestones, onPressProofPhoto }) => {
  return (
    <View style={styles.container}>
      {milestones.map((milestone, idx) => {
        const isLast = idx === milestones.length - 1;

        return (
          <View key={idx} style={styles.itemRow}>
            {/* Left track line & indicator */}
            <View style={styles.trackColumn}>
              <View
                style={[
                  styles.nodeCircle,
                  milestone.completed && styles.nodeCompleted,
                  milestone.active && styles.nodeActive,
                ]}
              >
                {milestone.completed ? (
                  <Icon name="checkmark" size={14} color="#FFFFFF" />
                ) : milestone.active ? (
                  <View style={styles.activeInnerDot} />
                ) : (
                  <View style={styles.pendingDot} />
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.verticalLine,
                    milestone.completed && styles.verticalLineCompleted,
                  ]}
                />
              )}
            </View>

            {/* Right content body */}
            <View style={styles.contentBody}>
              <View style={styles.headerRow}>
                <Text
                  style={[
                    styles.milestoneTitle,
                    milestone.active && styles.milestoneTitleActive,
                    !milestone.completed && !milestone.active && styles.milestoneTitlePending,
                  ]}
                >
                  {milestone.title}
                </Text>
                {milestone.completed && (
                  <Text style={styles.timeText}>{formatRelativeTime(milestone.timestamp)}</Text>
                )}
              </View>

              <Text style={styles.milestoneDesc}>{milestone.description}</Text>

              {milestone.performedBy && (
                <View style={styles.performerTag}>
                  <Icon name="person" size={12} color={theme.colors.textMuted} />
                  <Text style={styles.performerText}>{milestone.performedBy}</Text>
                </View>
              )}

              {milestone.estimatedTime && (
                <View style={styles.etaTag}>
                  <Icon name="time" size={12} color={theme.colors.warning} />
                  <Text style={styles.etaText}>{milestone.estimatedTime}</Text>
                </View>
              )}

              {milestone.proofPhotoUrl && (
                <TouchableOpacity
                  style={styles.proofCard}
                  onPress={() => onPressProofPhoto?.(milestone.proofPhotoUrl!)}
                >
                  <Image source={{ uri: milestone.proofPhotoUrl }} style={styles.proofThumb} />
                  <View style={styles.proofInfo}>
                    <Text style={styles.proofLabel}>Inspection Proof Photo</Text>
                    <Text style={styles.proofHint}>Tap to expand verification</Text>
                  </View>
                  <Icon name="open" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  trackColumn: {
    width: 28,
    alignItems: 'center',
  },
  nodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeCompleted: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  nodeActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  activeInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginTop: 2,
    marginBottom: -6,
  },
  verticalLineCompleted: {
    backgroundColor: theme.colors.success,
  },
  contentBody: {
    flex: 1,
    paddingLeft: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  milestoneTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  milestoneTitleActive: {
    color: theme.colors.primary,
  },
  milestoneTitlePending: {
    color: theme.colors.textMuted,
  },
  timeText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  milestoneDesc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  performerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  performerText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  etaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    alignSelf: 'flex-start',
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  proofCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 6,
    marginTop: 8,
    gap: 8,
  },
  proofThumb: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
  },
  proofInfo: {
    flex: 1,
  },
  proofLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  proofHint: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
});
