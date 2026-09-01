import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { VolunteerDrive } from '../../types/volunteer.types';
import { formatCategoryName } from '../../utils/string';
import { HapticFeedback } from '../../utils/haptics';

export interface VolunteerCardProps {
  drive: VolunteerDrive;
  onPressRsvp: () => void;
  onPressDetails?: () => void;
}

export const VolunteerCard: React.FC<VolunteerCardProps> = ({
  drive,
  onPressRsvp,
  onPressDetails,
}) => {
  const isFull = drive.currentRsvpCount >= drive.maxParticipants;
  const driveDate = new Date(drive.scheduledDate);

  return (
    <View style={styles.card}>
      {drive.photos.length > 0 && (
        <Image source={{ uri: drive.photos[0] }} style={styles.coverImage} resizeMode="cover" />
      )}

      <View style={styles.body}>
        {/* Header Tags */}
        <View style={styles.tagsRow}>
          <View style={styles.catBadge}>
            <Text style={styles.catText}>{formatCategoryName(drive.category)}</Text>
          </View>
          <View style={styles.karmaBadge}>
            <Icon name="award" size={12} color="#F59E0B" />
            <Text style={styles.karmaText}>+{drive.karmaRewardPoints} Pts</Text>
          </View>
        </View>

        <Text style={styles.title}>{drive.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {drive.description}
        </Text>

        {/* Date & Location Rows */}
        <View style={styles.metaRow}>
          <Icon name="calendar-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.metaText}>
            {driveDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
            {driveDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ({drive.durationHours} hrs)
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Icon name="location-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {drive.location.address}
          </Text>
        </View>

        {/* Perks ribbon */}
        <View style={styles.perksRow}>
          {drive.providedPerks.slice(0, 3).map((perk, idx) => (
            <View key={idx} style={styles.perkPill}>
              <Icon name="checkmark" size={10} color={theme.colors.success} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>

        {/* Capacity Bar & Action */}
        <View style={styles.actionFooter}>
          <View style={styles.capacityCol}>
            <Text style={styles.capacityText}>
              {drive.currentRsvpCount} / {drive.maxParticipants} Volunteers
            </Text>
            <View style={styles.capacityTrack}>
              <View
                style={[
                  styles.capacityFill,
                  { width: `${Math.min(100, (drive.currentRsvpCount / drive.maxParticipants) * 100)}%` },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.rsvpBtn,
              drive.hasUserRsvp && styles.rsvpBtnActive,
              !drive.hasUserRsvp && isFull && styles.rsvpBtnDisabled,
            ]}
            onPress={() => {
              HapticFeedback.medium();
              onPressRsvp();
            }}
            disabled={!drive.hasUserRsvp && isFull}
          >
            <Icon
              name={drive.hasUserRsvp ? 'checkmark-circle' : 'person-add'}
              size={14}
              color={drive.hasUserRsvp ? theme.colors.primary : '#FFFFFF'}
            />
            <Text
              style={[
                styles.rsvpBtnText,
                drive.hasUserRsvp && styles.rsvpBtnTextActive,
              ]}
            >
              {drive.hasUserRsvp ? 'Joined' : isFull ? 'Full' : 'Join Drive'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  coverImage: {
    width: '100%',
    height: 140,
  },
  body: {
    padding: theme.spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catBadge: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  karmaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  karmaText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  desc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
  },
  perksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: theme.spacing.sm,
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  perkText: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '600',
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  capacityCol: {
    flex: 1,
  },
  capacityText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  capacityTrack: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  rsvpBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  rsvpBtnDisabled: {
    backgroundColor: theme.colors.border,
  },
  rsvpBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  rsvpBtnTextActive: {
    color: theme.colors.primary,
  },
});
