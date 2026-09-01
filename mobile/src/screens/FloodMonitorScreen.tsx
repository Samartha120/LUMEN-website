import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { WaterGauge } from '../components/WaterGauge';
import { StormwaterSensor, FloodAlertPerimeter } from '../types/flood.types';
import { FloodService } from '../services/flood.service';

export const FloodMonitorScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [sensors, setSensors] = useState<StormwaterSensor[]>([]);
  const [perimeters, setPerimeters] = useState<FloodAlertPerimeter[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await FloodService.getSensors();
      const p = await FloodService.getFloodPerimeters();
      setSensors(s);
      setPerimeters(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      {/* Top Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Icon name="water" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.bannerTitle}>Stormwater & Flood Telemetry</Text>
        <Text style={styles.bannerDesc}>
          Live water level depth gauges across city canals, lake channels, and low-lying underpasses.
        </Text>
      </View>

      {/* Active Flood Vulnerability Alerts */}
      {perimeters.length > 0 && (
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Icon name="alert-circle" size={18} color="#EA580C" />
            <Text style={styles.alertTitle}>{perimeters[0].zoneName}</Text>
          </View>
          <Text style={styles.alertDesc}>
            Lake outflow surge detected. Avoid low-lying underpasses along{' '}
            {perimeters[0].affectedStreets.join(', ')}.
          </Text>
        </View>
      )}

      {/* Sensor Gauges List */}
      <Text style={styles.sectionTitle}>Active Stormwater Drainage Sensors</Text>
      <View style={styles.sensorsList}>
        {sensors.map(sensor => (
          <WaterGauge key={sensor.sensorId} sensor={sensor} />
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
  banner: {
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
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
  alertCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    marginBottom: theme.spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  alertTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '800',
    color: '#B45309',
  },
  alertDesc: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sensorsList: {
    gap: 4,
  },
});
