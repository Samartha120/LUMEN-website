import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { VolunteerCard } from '../components/VolunteerCard';
import { VolunteerDrive, VolunteerHourRecord } from '../types/volunteer.types';
import { VolunteerService } from '../services/volunteer.service';
import { HapticFeedback } from '../utils/haptics';

export const VolunteerDrivesScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [drives, setDrives] = useState<VolunteerDrive[]>([]);
  const [hours, setHours] = useState<VolunteerHourRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'DRIVES' | 'MY_HOURS'>('DRIVES');

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await VolunteerService.getDrives();
      const h = await VolunteerService.getVolunteerHours();
      setDrives(d);
      setHours(h);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleRsvp = async (drive: VolunteerDrive) => {
    try {
      const { hasUserRsvp } = await VolunteerService.toggleRsvp(drive.id);
      await loadData();
      if (hasUserRsvp) {
        Alert.alert(
          'RSVP Confirmed! 🎉',
          `You are registered for "${drive.title}". You will earn +${drive.karmaRewardPoints} Civic Karma points upon attendance.`
        );
      }
    } catch (err: any) {
      Alert.alert('Unable to RSVP', err?.message || 'Drive is currently full.');
    }
  };

  const totalHoursContributed = hours.reduce((acc, h) => acc + h.hoursContributed, 0);
  const totalKarmaFromVolunteering = hours.reduce((acc, h) => acc + h.karmaPointsEarned, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      {/* Top Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIconBox}>
          <Icon name="people" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.bannerTitle}>Civic Volunteer & Neighborhood Drives</Text>
        <Text style={styles.bannerDesc}>
          Collaborate with neighbors and ward engineers for cleanups, greening, and hazard marking.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsStrip}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'DRIVES' && styles.tabBtnActive]}
          onPress={() => {
            HapticFeedback.light();
            setTab('DRIVES');
          }}
        >
          <Text style={[styles.tabText, tab === 'DRIVES' && styles.tabTextActive]}>
            Upcoming Drives ({drives.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'MY_HOURS' && styles.tabBtnActive]}
          onPress={() => {
            HapticFeedback.light();
            setTab('MY_HOURS');
          }}
        >
          <Text style={[styles.tabText, tab === 'MY_HOURS' && styles.tabTextActive]}>
            My Service Hours ({totalHoursContributed} hrs)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Drives List */}
      {tab === 'DRIVES' && (
        <View style={styles.list}>
          {drives.map(drive => (
            <VolunteerCard
              key={drive.id}
              drive={drive}
              onPressRsvp={() => handleToggleRsvp(drive)}
            />
          ))}
        </View>
      )}

      {/* Tab 2: Service Hours Log */}
      {tab === 'MY_HOURS' && (
        <View style={styles.hoursContainer}>
          <View style={styles.summaryStats}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{totalHoursContributed} hrs</Text>
              <Text style={styles.statLabel}>Total Contributed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#F59E0B' }]}>
                +{totalKarmaFromVolunteering}
              </Text>
              <Text style={styles.statLabel}>Karma Points</Text>
            </View>
          </View>

          <Text style={styles.historyTitle}>Verified Service History</Text>
          {hours.map(h => (
            <View key={h.id} style={styles.hourCard}>
              <View style={styles.hourTop}>
                <Text style={styles.driveTitle}>{h.driveTitle}</Text>
                <View style={styles.verifiedTag}>
                  <Icon name="checkmark-circle" size={12} color={theme.colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>

              <View style={styles.hourMeta}>
                <Text style={styles.hourText}>{h.hoursContributed} Hours Logged</Text>
                <Text style={styles.karmaText}>+{h.karmaPointsEarned} Pts</Text>
              </View>

              {h.certificateUrl && (
                <TouchableOpacity
                  style={styles.certBtn}
                  onPress={() => Alert.alert('Certificate Downloaded', 'Viewing digital volunteer certificate.')}
                >
                  <Icon name="document-text-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.certBtnText}>Download Civic Certificate</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
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
  banner: {
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  bannerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  bannerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  bannerDesc: {
    fontSize: theme.typography.sizes.xs,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  tabsStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: theme.radius.md,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  list: {
    gap: 4,
  },
  hoursContainer: {
    gap: theme.spacing.md,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  historyTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
  },
  hourCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  hourTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  driveTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.success,
  },
  hourMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hourText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  karmaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  certBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    marginTop: 4,
  },
  certBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
