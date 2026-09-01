import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { useEmergencyAlerts } from '../state/EmergencyAlertContext';
import { HazardAlert } from '../components/HazardAlert';
import { HapticFeedback } from '../utils/haptics';

export const EmergencySOSScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { hazards, loading, refreshHazards, acknowledgeHazard } = useEmergencyAlerts();

  const handleCall = (number: string) => {
    HapticFeedback.heavy();
    Alert.alert('Emergency Call', `Initiating priority connection to ${number}...`);
  };

  const handleDetour = (hazard: any) => {
    Alert.alert('Safe Detour Guide', `Rerouting around ${hazard.address}.\n\n${hazard.safeDetourNotes}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshHazards} />}
    >
      {/* Top emergency SOS header card */}
      <View style={styles.sosCard}>
        <View style={styles.sosIconCircle}>
          <Icon name="warning" size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.sosTitle}>Civil Safety & Emergency Perimeter</Text>
        <Text style={styles.sosDesc}>
          Live broadcasts for high-voltage wire snaps, open manholes, and critical road collapses.
        </Text>
      </View>

      {/* Active Hazards List */}
      <Text style={styles.sectionTitle}>
        Active Alerts in your Vicinity ({hazards.length})
      </Text>

      {hazards.map(h => (
        <HazardAlert
          key={h.id}
          hazard={h}
          onAcknowledge={() => acknowledgeHazard(h.id)}
          onPressDetour={() => handleDetour(h)}
          onCallEmergency={num => handleCall(num)}
        />
      ))}

      {/* Quick Dial Emergency Contacts */}
      <Text style={styles.sectionTitle}>Direct Civic Helplines</Text>
      <View style={styles.helplineGrid}>
        {[
          { name: 'City Disaster Control', num: '1077', icon: 'shield' },
          { name: 'Bescom Power Isolation', num: '1912', icon: 'flash' },
          { name: 'Water & Drain Emergency', num: '1916', icon: 'water' },
          { name: 'Police & Traffic Control', num: '112', icon: 'car' },
        ].map((line, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.helplineCard}
            onPress={() => handleCall(line.num)}
          >
            <View style={styles.helpIconBox}>
              <Icon name={line.icon as any} size={18} color={theme.colors.primary} />
            </View>
            <Text style={styles.helpName}>{line.name}</Text>
            <Text style={styles.helpNum}>Dial {line.num}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  sosCard: {
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  sosIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  sosTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  sosDesc: {
    fontSize: theme.typography.sizes.xs,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  helplineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  helplineCard: {
    width: '48%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  helpIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  helpName: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  helpNum: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 2,
  },
});
