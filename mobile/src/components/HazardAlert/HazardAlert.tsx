import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { HazardBroadcast } from '../../types/emergency.types';
import { formatDistance } from '../../utils/geo';
import { HapticFeedback } from '../../utils/haptics';

export interface HazardAlertProps {
  hazard: HazardBroadcast & { distanceMeters?: number };
  onAcknowledge?: () => void;
  onPressDetour?: () => void;
  onCallEmergency?: (phone: string) => void;
}

export const HazardAlert: React.FC<HazardAlertProps> = ({
  hazard,
  onAcknowledge,
  onPressDetour,
  onCallEmergency,
}) => {
  const isLifeThreatening = hazard.severity === 'LIFE_THREATENING';

  return (
    <View
      style={[
        styles.container,
        isLifeThreatening ? styles.containerCritical : styles.containerWarning,
      ]}
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.sirenRow}>
          <Icon
            name={isLifeThreatening ? 'warning' : 'alert-circle'}
            size={20}
            color={isLifeThreatening ? theme.colors.danger : theme.colors.warning}
          />
          <Text
            style={[
              styles.severityBadgeText,
              { color: isLifeThreatening ? theme.colors.danger : '#D97706' },
            ]}
          >
            {isLifeThreatening ? 'LIFE-THREATENING EMERGENCY' : 'CIVIC HAZARD ALERT'}
          </Text>
        </View>

        {hazard.distanceMeters !== undefined && (
          <View style={styles.distanceBadge}>
            <Icon name="navigate" size={12} color="#FFFFFF" />
            <Text style={styles.distanceText}>{formatDistance(hazard.distanceMeters)} away</Text>
          </View>
        )}
      </View>

      {/* Main Title & Summary */}
      <Text style={styles.title}>{hazard.title}</Text>
      <Text style={styles.summary}>{hazard.summary}</Text>

      {/* Instructions list */}
      {hazard.evacuationOrSafetyInstructions.length > 0 && (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsHeader}>Safety Instructions:</Text>
          {hazard.evacuationOrSafetyInstructions.map((ins, i) => (
            <View key={i} style={styles.instructionItem}>
              <Text style={styles.instructionBullet}>•</Text>
              <Text style={styles.instructionText}>{ins}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Safe detour note */}
      {hazard.safeDetourNotes && (
        <View style={styles.detourBox}>
          <Icon name="git-branch" size={14} color={theme.colors.primary} />
          <Text style={styles.detourText}>{hazard.safeDetourNotes}</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {hazard.safeDetourNotes && onPressDetour && (
          <TouchableOpacity
            style={styles.detourBtn}
            onPress={() => {
              HapticFeedback.medium();
              onPressDetour();
            }}
          >
            <Icon name="map" size={14} color="#FFFFFF" />
            <Text style={styles.detourBtnText}>Safe Detour Route</Text>
          </TouchableOpacity>
        )}

        {hazard.emergencyContactNumbers.length > 0 && onCallEmergency && (
          <TouchableOpacity
            style={styles.emergencyCallBtn}
            onPress={() => {
              HapticFeedback.heavy();
              onCallEmergency(hazard.emergencyContactNumbers[0].number);
            }}
          >
            <Icon name="call" size={14} color="#FFFFFF" />
            <Text style={styles.emergencyCallText}>
              Dial {hazard.emergencyContactNumbers[0].number}
            </Text>
          </TouchableOpacity>
        )}

        {!hazard.hasUserAcknowledged && onAcknowledge && (
          <TouchableOpacity
            style={styles.ackBtn}
            onPress={() => {
              HapticFeedback.light();
              onAcknowledge();
            }}
          >
            <Icon name="checkmark" size={14} color={theme.colors.textMuted} />
            <Text style={styles.ackBtnText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1.5,
  },
  containerCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: theme.colors.danger,
  },
  containerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  sirenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  summary: {
    fontSize: theme.typography.sizes.xs,
    color: '#334155',
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  instructionsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  instructionsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  instructionItem: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 3,
  },
  instructionBullet: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: '900',
  },
  instructionText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
    lineHeight: 16,
  },
  detourBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  detourText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  detourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  detourBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  emergencyCallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginLeft: 'auto',
  },
  ackBtnText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
});
