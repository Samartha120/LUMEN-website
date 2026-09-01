import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { Timeline } from '../components/Timeline';
import { RatingDialog } from '../components/RatingDialog';
import { LiveComplaintTracking, TrackingStage } from '../types/tracking.types';
import { TrackingService } from '../services/tracking.service';
import { formatSLACountdown } from '../utils/date';
import { HapticFeedback } from '../utils/haptics';

export const LiveTrackingScreen: React.FC<{ route?: any; navigation?: any }> = ({
  route,
  navigation,
}) => {
  const complaintId = route?.params?.complaintId || 'cmp-001';
  const [tracking, setTracking] = useState<LiveComplaintTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRatingVisible, setIsRatingVisible] = useState(false);

  const loadTracking = async () => {
    setLoading(true);
    try {
      const data = await TrackingService.getTracking(complaintId);
      setTracking(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracking();
  }, [complaintId]);

  const handleEscalate = async () => {
    if (!tracking) return;
    HapticFeedback.heavy();

    Alert.alert(
      'Escalate Ticket to Zonal Superintendent',
      'Are you experiencing a dangerous safety escalation or SLA delay on this ticket?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Escalation',
          style: 'destructive',
          onPress: async () => {
            await TrackingService.requestEscalation({
              complaintId: tracking.complaintId,
              reason: 'HAZARD_INCREASED',
              note: 'Citizen requested priority review due to live road safety risk.',
              urgencyBoost: true,
              timestamp: new Date().toISOString(),
            });
            await loadTracking();
            Alert.alert('Escalated', 'Supervisor has been notified with high urgency alert.');
          },
        },
      ]
    );
  };

  if (!tracking) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading live telemetry...</Text>
      </View>
    );
  }

  const sla = formatSLACountdown(tracking.slaDeadline);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header status badge card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={styles.ticketNumber}>Ticket #{tracking.ticketNumber}</Text>
            <Text style={styles.locationText}>{tracking.incidentLocation.address}</Text>
          </View>
          <View
            style={[
              styles.slaBadge,
              sla.urgencyLevel === 'CRITICAL_BREACH'
                ? styles.slaBadgeDanger
                : sla.urgencyLevel === 'WARNING'
                ? styles.slaBadgeWarning
                : styles.slaBadgeNormal,
            ]}
          >
            <Icon name="time" size={12} color="#FFFFFF" />
            <Text style={styles.slaBadgeText}>{sla.formattedText}</Text>
          </View>
        </View>

        {/* Assigned engineer dispatch card */}
        {tracking.assignedEngineer && (
          <View style={styles.engineerBox}>
            <View style={styles.engineerAvatar}>
              <Icon name="person" size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.engineerName}>{tracking.assignedEngineer.name}</Text>
              <Text style={styles.vehicleText}>{tracking.assignedEngineer.vehicleNumber}</Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => {
                HapticFeedback.light();
                Alert.alert('Calling Field Crew', `Dialing ${tracking.assignedEngineer?.phone}`);
              }}
            >
              <Icon name="call" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Interactive Milestones Timeline */}
      <Text style={styles.sectionHeader}>Live Dispatch & Repair Milestones</Text>
      <View style={styles.timelineCard}>
        <Timeline milestones={tracking.milestones} />
      </View>

      {/* Escalation & Actions Bar */}
      <View style={styles.actionsBar}>
        {tracking.canEscalate && (
          <TouchableOpacity style={styles.escalateBtn} onPress={handleEscalate}>
            <Icon name="alert-circle" size={18} color="#FFFFFF" />
            <Text style={styles.escalateText}>Escalate to Zonal Supervisor</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.rateBtn}
          onPress={() => {
            HapticFeedback.light();
            setIsRatingVisible(true);
          }}
        >
          <Icon name="star-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.rateText}>Provide Feedback</Text>
        </TouchableOpacity>
      </View>

      {/* Rating modal */}
      <RatingDialog
        visible={isRatingVisible}
        ticketNumber={tracking.ticketNumber}
        onClose={() => setIsRatingVisible(false)}
        onSubmit={(rating, feedback) => {
          Alert.alert('Thank you!', `Your rating of ${rating} stars has been recorded.`);
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  statusCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  ticketNumber: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
  },
  locationText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    maxWidth: 200,
  },
  slaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  slaBadgeNormal: {
    backgroundColor: theme.colors.success,
  },
  slaBadgeWarning: {
    backgroundColor: '#F59E0B',
  },
  slaBadgeDanger: {
    backgroundColor: theme.colors.danger,
  },
  slaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  engineerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  engineerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  engineerName: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  vehicleText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  callBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  timelineCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  actionsBar: {
    gap: 10,
  },
  escalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.danger,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  escalateText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  rateText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
});
