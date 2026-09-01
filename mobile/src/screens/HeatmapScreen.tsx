import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { CivicMap } from '../components/CivicMap';
import { FilterPill } from '../components/FilterPill';
import { StatisticGrid } from '../components/StatisticGrid';
import { HeatmapPoint, IncidentCluster, WardSafetyScore } from '../types/heatmap.types';
import { HeatmapService } from '../services/heatmap.service';
import { HapticFeedback } from '../utils/haptics';

const CATEGORY_OPTIONS = [
  { id: 'ALL', label: 'All Hazards' },
  { id: 'roads', label: 'Roads & Potholes' },
  { id: 'electrical', label: 'Power & Cables' },
  { id: 'water', label: 'Drains & Water' },
  { id: 'waste', label: 'Waste Dumps' },
];

export const HeatmapScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [clusters, setClusters] = useState<IncidentCluster[]>([]);
  const [wards, setWards] = useState<WardSafetyScore[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<IncidentCluster | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const pts = await HeatmapService.getHeatmapPoints(
        selectedCategory !== 'ALL' ? { categories: [selectedCategory as any] } : undefined
      );
      const cl = await HeatmapService.getIncidentClusters();
      const wrd = await HeatmapService.getWardSafetyScores();
      setPoints(pts);
      setClusters(cl);
      setWards(wrd);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      {/* Category filter strip */}
      <FilterPill
        options={CATEGORY_OPTIONS}
        selectedId={selectedCategory}
        onSelect={cat => {
          HapticFeedback.light();
          setSelectedCategory(cat);
        }}
      />

      {/* Map visual canvas */}
      <View style={styles.mapCard}>
        <CivicMap
          points={points}
          clusters={clusters}
          onSelectPoint={p => {
            // handle point select
          }}
          onSelectCluster={c => setSelectedCluster(c)}
        />
      </View>

      {/* City-wide KPI summary stats */}
      <Text style={styles.sectionHeader}>Spatial Risk Analytics</Text>
      <StatisticGrid
        stats={[
          {
            label: 'Active Hazard Density',
            value: '4.2/km²',
            subValue: 'East Zone Moderate',
            icon: 'analytics-outline',
            color: '#F59E0B',
          },
          {
            label: 'Avg Resolution SLA',
            value: '26.4 hrs',
            subValue: '-18% from last month',
            icon: 'speedometer-outline',
            color: '#10B981',
          },
          {
            label: 'Identified Hotzones',
            value: clusters.length,
            subValue: '2 Critical Perimeters',
            icon: 'flame-outline',
            color: '#EF4444',
          },
          {
            label: 'Safe Ward Index',
            value: '84/100',
            subValue: 'Top: Domlur & Koramangala',
            icon: 'shield-checkmark-outline',
            color: '#3B82F6',
          },
        ]}
      />

      {/* Ward Safety Leaderboard */}
      <View style={styles.wardCard}>
        <View style={styles.wardHeader}>
          <Icon name="podium-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.wardTitle}>Ward Infrastructure Health Ranking</Text>
        </View>

        {wards.map((w, idx) => (
          <View key={w.wardNumber} style={styles.wardRow}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{idx + 1}</Text>
            </View>

            <View style={styles.wardInfo}>
              <Text style={styles.wardName}>
                {w.wardNumber} - {w.wardName}
              </Text>
              <Text style={styles.zoneText}>{w.zone} • {w.openIssuesCount} open issues</Text>
            </View>

            <View style={styles.scoreCol}>
              <Text
                style={[
                  styles.scoreVal,
                  { color: w.safetyScore >= 80 ? '#10B981' : w.safetyScore >= 65 ? '#F59E0B' : '#EF4444' },
                ]}
              >
                {w.safetyScore}/100
              </Text>
              <Text style={styles.scoreLabel}>Health Index</Text>
            </View>
          </View>
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
  mapCard: {
    marginVertical: theme.spacing.sm,
  },
  sectionHeader: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  wardCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
  },
  wardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  wardTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
  },
  wardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  wardInfo: {
    flex: 1,
  },
  wardName: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  zoneText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  scoreCol: {
    alignItems: 'flex-end',
  },
  scoreVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
  },
});
