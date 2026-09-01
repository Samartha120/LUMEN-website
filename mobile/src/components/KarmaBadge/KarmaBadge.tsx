import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { KarmaBadge as KarmaBadgeModel, KarmaTier } from '../../types/karma.types';

export interface KarmaBadgeProps {
  badge: KarmaBadgeModel;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const KarmaBadge: React.FC<KarmaBadgeProps> = ({ badge, onPress, size = 'md' }) => {
  const getTierGradientColor = (tier: KarmaTier) => {
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

  const isSmall = size === 'sm';
  const tierColor = getTierGradientColor(badge.tier);

  return (
    <TouchableOpacity
      style={[
        styles.badgeCard,
        !badge.isUnlocked && styles.badgeCardLocked,
        isSmall && styles.badgeCardSmall,
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: badge.isUnlocked ? tierColor : theme.colors.border },
          isSmall && styles.iconCircleSmall,
        ]}
      >
        <Icon
          name={badge.isUnlocked ? (badge.iconName as any) : 'lock-closed'}
          size={isSmall ? 16 : 24}
          color="#FFFFFF"
        />
      </View>

      <View style={styles.badgeInfo}>
        <Text style={[styles.badgeName, isSmall && styles.badgeNameSmall]} numberOfLines={1}>
          {badge.name}
        </Text>
        {!isSmall && (
          <Text style={styles.badgeDesc} numberOfLines={2}>
            {badge.description}
          </Text>
        )}

        {/* Progress bar if locked */}
        {!badge.isUnlocked && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${badge.progressPercent}%`, backgroundColor: tierColor },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{badge.progressPercent}%</Text>
          </View>
        )}

        {badge.isUnlocked && (
          <View style={styles.unlockedTag}>
            <Text style={[styles.unlockedText, { color: tierColor }]}>
              +{badge.pointsReward} Pts
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  badgeCardLocked: {
    opacity: 0.75,
    backgroundColor: theme.colors.background,
  },
  badgeCardSmall: {
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  iconCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  badgeNameSmall: {
    fontSize: theme.typography.sizes.xs,
  },
  badgeDesc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  progressBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  unlockedTag: {
    marginTop: 4,
  },
  unlockedText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
