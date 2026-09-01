import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { CivicRouteOption } from '../../types/route.types';
import { formatDistance } from '../../utils/geo';
import { HapticFeedback } from '../../utils/haptics';

export interface SafeRouteMapProps {
  routes: CivicRouteOption[];
  selectedRouteId: string;
  onSelectRoute: (routeId: string) => void;
  onStartNavigation?: (route: CivicRouteOption) => void;
}

export const SafeRouteMap: React.FC<SafeRouteMapProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  onStartNavigation,
}) => {
  const selectedRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

  return (
    <View style={styles.container}>
      {/* Visual map route canvas mockup */}
      <View style={styles.mapCanvas}>
        {/* Route paths representation */}
        <View style={styles.routePathContainer}>
          <View style={styles.originMarker}>
            <View style={styles.originDot} />
            <Text style={styles.markerText}>Origin</Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.destMarker}>
            <Icon name="flag" size={14} color="#FFFFFF" />
          </View>
        </View>

        {/* Hazard warning callout if route has active hazard */}
        {selectedRoute.activeHazardsOnRouteCount > 0 ? (
          <View style={styles.hazardOverlay}>
            <Icon name="warning" size={14} color="#EF4444" />
            <Text style={styles.hazardOverlayText}>
              1 Reported road defect on selected cut-through
            </Text>
          </View>
        ) : (
          <View style={styles.safeClearanceOverlay}>
            <Icon name="shield-checkmark" size={14} color="#10B981" />
            <Text style={styles.safeClearanceText}>
              All reported civic hazards bypassed successfully
            </Text>
          </View>
        )}
      </View>

      {/* Route selection cards */}
      <View style={styles.routeCardsContainer}>
        {routes.map(r => {
          const isSelected = r.id === selectedRouteId;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.routeCard, isSelected && styles.routeCardSelected]}
              onPress={() => {
                HapticFeedback.light();
                onSelectRoute(r.id);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeTitle}>{r.title}</Text>
                  <Text style={styles.routeSummary}>{r.summary}</Text>
                </View>

                <View style={styles.scoreCol}>
                  <Text
                    style={[
                      styles.safetyScoreText,
                      { color: r.overallSafetyScore >= 90 ? '#10B981' : r.overallSafetyScore >= 75 ? '#F59E0B' : '#EF4444' },
                    ]}
                  >
                    {r.overallSafetyScore}
                  </Text>
                  <Text style={styles.safetyScoreLabel}>Safety Score</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.footerMetric}>
                  <Icon name="time-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={styles.metricText}>{r.estimatedMinutes} mins</Text>
                </View>

                <View style={styles.footerMetric}>
                  <Icon name="navigate-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={styles.metricText}>{formatDistance(r.totalDistanceMeters)}</Text>
                </View>

                <View style={styles.footerMetric}>
                  <Icon name="sunny-outline" size={13} color="#F59E0B" />
                  <Text style={styles.metricText}>{r.lightingScore}% Lit</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Start navigation button */}
      {onStartNavigation && (
        <TouchableOpacity
          style={styles.navigateBtn}
          onPress={() => {
            HapticFeedback.success();
            onStartNavigation(selectedRoute);
          }}
        >
          <Icon name="navigate" size={18} color="#FFFFFF" />
          <Text style={styles.navigateBtnText}>Start Safe Navigation</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  mapCanvas: {
    height: 180,
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.lg,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  routePathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  originMarker: {
    alignItems: 'center',
    gap: 4,
  },
  originDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  routeLine: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(59, 130, 246, 0.6)',
    marginHorizontal: 12,
  },
  destMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hazardOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hazardOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  safeClearanceOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  safeClearanceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  routeCardsContainer: {
    gap: 8,
  },
  routeCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  routeCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.03)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  routeTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
  },
  routeSummary: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  scoreCol: {
    alignItems: 'flex-end',
  },
  safetyScoreText: {
    fontSize: 18,
    fontWeight: '900',
  },
  safetyScoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  footerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    marginTop: 4,
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
});
