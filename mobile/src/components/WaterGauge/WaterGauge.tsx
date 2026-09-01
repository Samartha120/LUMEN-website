import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { StormwaterSensor } from '../../types/flood.types';

export interface WaterGaugeProps {
  sensor: StormwaterSensor;
}

export const WaterGauge: React.FC<WaterGaugeProps> = ({ sensor }) => {
  const getStatusColor = () => {
    switch (sensor.status) {
      case 'NORMAL':
        return { color: theme.colors.success, bg: 'rgba(16, 185, 129, 0.1)', label: 'Normal Flow' };
      case 'ELEVATED':
        return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', label: 'Elevated' };
      case 'WARNING':
        return { color: '#EA580C', bg: 'rgba(234, 88, 12, 0.1)', label: 'Warning' };
      case 'OVERFLOW_DANGER':
        return { color: theme.colors.danger, bg: '#FEF2F2', label: 'Overflow Hazard' };
    }
  };

  const statusInfo = getStatusColor();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>{sensor.locationName}</Text>
          <Text style={styles.sensorId}>{sensor.sensorId} • {sensor.sensorType.replace('_', ' ')}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Water level visualization gauge */}
      <View style={styles.gaugeContainer}>
        <View style={styles.levelRow}>
          <Text style={styles.depthVal}>
            {sensor.currentDepthMeters.toFixed(2)} m
          </Text>
          <Text style={styles.maxDepthText}>
            / {sensor.maxCapacityMeters.toFixed(1)} m Max
          </Text>
          <Text style={[styles.percentText, { color: statusInfo.color }]}>
            {sensor.capacityUtilizationPercentage}% Full
          </Text>
        </View>

        <View style={styles.gaugeTrack}>
          <View
            style={[
              styles.gaugeFill,
              {
                width: `${sensor.capacityUtilizationPercentage}%`,
                backgroundColor: statusInfo.color,
              },
            ]}
          />
        </View>
      </View>

      {/* Metrics footer */}
      <View style={styles.metricsFooter}>
        <View style={styles.metricItem}>
          <Icon name="trending-up" size={12} color={theme.colors.textMuted} />
          <Text style={styles.metricLabel}>
            Rise Rate: <Text style={styles.metricBold}>{sensor.rateOfRiseCmPerHour} cm/hr</Text>
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Icon name="rainy-outline" size={12} color={theme.colors.textMuted} />
          <Text style={styles.metricLabel}>
            Rainfall: <Text style={styles.metricBold}>{sensor.rainfallLast24HoursMm} mm</Text>
          </Text>
        </View>

        {sensor.pumpStationActive && (
          <View style={styles.pumpActiveBadge}>
            <Icon name="sync" size={10} color="#FFFFFF" />
            <Text style={styles.pumpActiveText}>Pump Running</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  locationTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sensorId: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  gaugeContainer: {
    marginVertical: 4,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  depthVal: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  maxDepthText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  gaugeTrack: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
  },
  metricsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  metricBold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  pumpActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    marginLeft: 'auto',
  },
  pumpActiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
