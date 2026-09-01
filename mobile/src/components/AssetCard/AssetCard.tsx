import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { MunicipalAsset } from '../../types/asset.types';
import { formatCategoryName } from '../../utils/string';
import { formatRelativeTime } from '../../utils/date';

export interface AssetCardProps {
  asset: MunicipalAsset;
  onPressReportIssue?: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onPressReportIssue }) => {
  const getHealthBadge = () => {
    switch (asset.healthStatus) {
      case 'OPERATIONAL':
        return { label: 'Operational', color: theme.colors.success, bg: 'rgba(16, 185, 129, 0.1)' };
      case 'DEGRADED':
        return { label: 'Degraded', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'CRITICAL_FAULT':
        return { label: 'Critical Fault', color: theme.colors.danger, bg: '#FEF2F2' };
      default:
        return { label: 'Maintenance', color: theme.colors.primary, bg: 'rgba(37, 99, 235, 0.1)' };
    }
  };

  const badge = getHealthBadge();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.qrTagBox}>
          <Icon name="qr-code" size={14} color={theme.colors.primary} />
          <Text style={styles.qrTagText}>{asset.qrCodeTag}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      <Text style={styles.name}>{asset.name}</Text>
      <Text style={styles.spec}>{asset.specification}</Text>

      {/* Health score gauge */}
      <View style={styles.healthRow}>
        <Text style={styles.healthLabel}>Component Health Score:</Text>
        <Text
          style={[
            styles.healthScoreVal,
            { color: asset.healthScore >= 80 ? '#10B981' : asset.healthScore >= 60 ? '#F59E0B' : '#EF4444' },
          ]}
        >
          {asset.healthScore}%
        </Text>
      </View>

      <View style={styles.healthTrack}>
        <View
          style={[
            styles.healthFill,
            {
              width: `${asset.healthScore}%`,
              backgroundColor: asset.healthScore >= 80 ? '#10B981' : asset.healthScore >= 60 ? '#F59E0B' : '#EF4444',
            },
          ]}
        />
      </View>

      <View style={styles.metaInfo}>
        <Text style={styles.metaItem}>
          <Text style={styles.metaBold}>Ward:</Text> {asset.wardNumber}
        </Text>
        <Text style={styles.metaItem}>
          <Text style={styles.metaBold}>Last Inspected:</Text> {formatRelativeTime(asset.lastInspectedAt)}
        </Text>
      </View>

      {onPressReportIssue && (
        <TouchableOpacity style={styles.reportIssueBtn} onPress={onPressReportIssue}>
          <Icon name="alert-circle-outline" size={16} color={theme.colors.danger} />
          <Text style={styles.reportIssueText}>Report Defect on this Asset</Text>
        </TouchableOpacity>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  qrTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  qrTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
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
  name: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2,
  },
  spec: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  healthLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  healthScoreVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  healthTrack: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  healthFill: {
    height: '100%',
  },
  metaInfo: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  metaItem: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  metaBold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  reportIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    marginTop: 10,
  },
  reportIssueText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.danger,
  },
});
