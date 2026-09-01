import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { HeatmapPoint, IncidentCluster } from '../../types/heatmap.types';
import { formatCategoryName } from '../../utils/string';
import { HapticFeedback } from '../../utils/haptics';

export interface CivicMapProps {
  points: HeatmapPoint[];
  clusters?: IncidentCluster[];
  onSelectPoint?: (point: HeatmapPoint) => void;
  onSelectCluster?: (cluster: IncidentCluster) => void;
  userLocationName?: string;
}

export const CivicMap: React.FC<CivicMapProps> = ({
  points,
  clusters = [],
  onSelectPoint,
  onSelectCluster,
  userLocationName = 'Indiranagar, Bengaluru',
}) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<'HEATMAP' | 'CLUSTERS' | 'ALL'>('ALL');

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'roads':
        return '#F59E0B'; // Amber
      case 'electrical':
        return '#EF4444'; // Red
      case 'waste':
        return '#10B981'; // Green
      case 'water':
        return '#3B82F6'; // Blue
      case 'public_property':
        return '#8B5CF6'; // Purple
      default:
        return theme.colors.primary;
    }
  };

  const handlePointPress = (p: HeatmapPoint) => {
    HapticFeedback.light();
    setSelectedPointId(p.id === selectedPointId ? null : p.id);
    onSelectPoint?.(p);
  };

  return (
    <View style={styles.container}>
      {/* Map visual canvas representation */}
      <View style={styles.canvasContainer}>
        {/* Mock Grid Lines & Background */}
        <View style={styles.gridOverlay}>
          <View style={styles.gridLineHorizontal} />
          <View style={styles.gridLineHorizontal} />
          <View style={styles.gridLineVertical} />
          <View style={styles.gridLineVertical} />
        </View>

        {/* Heatmap density rings & points */}
        {points.map((pt, idx) => {
          // Compute pseudo screen positions for rich interactive canvas visualization
          const posX = 15 + ((idx * 37) % 70);
          const posY = 20 + ((idx * 43) % 60);
          const isSelected = selectedPointId === pt.id;
          const color = getCategoryColor(pt.category);

          return (
            <TouchableOpacity
              key={pt.id}
              style={[
                styles.pointWrapper,
                {
                  left: `${posX}%`,
                  top: `${posY}%`,
                },
              ]}
              onPress={() => handlePointPress(pt)}
              activeOpacity={0.8}
            >
              {/* Density glow */}
              <View
                style={[
                  styles.densityRing,
                  {
                    backgroundColor: color,
                    opacity: pt.weight * 0.25,
                    transform: [{ scale: 1 + pt.weight * 0.8 }],
                  },
                ]}
              />

              {/* Center pin */}
              <View
                style={[
                  styles.pinDot,
                  { backgroundColor: color },
                  isSelected && styles.pinDotSelected,
                ]}
              >
                <Text style={styles.pinCount}>{pt.complaintCount}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* User Location Radar Marker */}
        <View style={styles.userRadar}>
          <View style={styles.userRadarRing} />
          <View style={styles.userRadarDot} />
        </View>

        {/* Layer Selector Overlay */}
        <View style={styles.layerSelector}>
          <TouchableOpacity
            style={[styles.layerBtn, mapLayer === 'ALL' && styles.layerBtnActive]}
            onPress={() => {
              HapticFeedback.light();
              setMapLayer('ALL');
            }}
          >
            <Text style={[styles.layerText, mapLayer === 'ALL' && styles.layerTextActive]}>
              All Pins
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layerBtn, mapLayer === 'HEATMAP' && styles.layerBtnActive]}
            onPress={() => {
              HapticFeedback.light();
              setMapLayer('HEATMAP');
            }}
          >
            <Text style={[styles.layerText, mapLayer === 'HEATMAP' && styles.layerTextActive]}>
              Density
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layerBtn, mapLayer === 'CLUSTERS' && styles.layerBtnActive]}
            onPress={() => {
              HapticFeedback.light();
              setMapLayer('CLUSTERS');
            }}
          >
            <Text style={[styles.layerText, mapLayer === 'CLUSTERS' && styles.layerTextActive]}>
              Hotzones
            </Text>
          </TouchableOpacity>
        </View>

        {/* Location banner pill */}
        <View style={styles.locationBanner}>
          <Icon name="location" size={14} color={theme.colors.primary} />
          <Text style={styles.locationBannerText}>{userLocationName}</Text>
        </View>
      </View>

      {/* Selected Point Info Callout */}
      {selectedPointId && (
        <View style={styles.callout}>
          {(() => {
            const pt = points.find(p => p.id === selectedPointId);
            if (!pt) return null;
            return (
              <View style={styles.calloutContent}>
                <View
                  style={[
                    styles.categoryIndicator,
                    { backgroundColor: getCategoryColor(pt.category) },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.calloutTitle}>{formatCategoryName(pt.category)}</Text>
                  <Text style={styles.calloutSubtitle}>
                    {pt.complaintCount} active reports • Priority: {pt.priority}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.calloutAction}
                  onPress={() => onSelectPoint?.(pt)}
                >
                  <Text style={styles.calloutActionText}>Details</Text>
                  <Icon name="arrow-forward" size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  canvasContainer: {
    height: 280,
    backgroundColor: '#0F172A', // Dark modern blueprint slate
    position: 'relative',
    overflow: 'hidden',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-around',
  },
  gridLineHorizontal: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    width: '100%',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    left: '50%',
  },
  pointWrapper: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -22,
    marginTop: -22,
  },
  densityRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  pinDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  pinDotSelected: {
    borderColor: '#FACC15',
    transform: [{ scale: 1.2 }],
  },
  pinCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  userRadar: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -16,
    marginTop: -16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userRadarRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.6)',
  },
  userRadarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  layerSelector: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: theme.radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  layerBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  layerBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  layerText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  layerTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationBanner: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    borderRadius: theme.radius.md,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  locationBannerText: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  callout: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  calloutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  categoryIndicator: {
    width: 10,
    height: 36,
    borderRadius: 5,
  },
  calloutTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  calloutSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  calloutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  calloutActionText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
