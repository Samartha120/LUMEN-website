import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { HapticFeedback } from '../../utils/haptics';

export const VerificationScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [similarityScore, setSimilarityScore] = useState(92);
  const [repairVerdict, setRepairVerdict] = useState<'APPROVED' | 'REQUIRES_REWORK'>('APPROVED');

  const beforePhoto = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600';
  const afterPhoto = 'https://images.unsplash.com/photo-1578991624414-276ef23a534f?w=600';

  const handleVerify = () => {
    HapticFeedback.success();
    Alert.alert(
      'AI Verification Signed',
      'Repair quality verified with 92% visual clearance. Work order marked COMPLETED and public transparency log updated.',
      [{ text: 'Return to Queue', onPress: () => navigation?.goBack?.() }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Banner */}
      <View style={styles.banner}>
        <Icon name="scan" size={20} color="#FFFFFF" />
        <Text style={styles.bannerText}>AI-Assisted Computer Vision Verification</Text>
      </View>

      {/* Side by side before/after visual inspection */}
      <View style={styles.photosGrid}>
        <View style={styles.photoCol}>
          <Text style={styles.colLabel}>Before (Citizen Photo)</Text>
          <Image source={{ uri: beforePhoto }} style={styles.photo} />
          <View style={styles.metaBox}>
            <Text style={styles.metaClass}>Pothole: 14cm Depth</Text>
            <Text style={styles.metaConf}>94% AI Confidence</Text>
          </View>
        </View>

        <View style={styles.photoCol}>
          <Text style={styles.colLabel}>After (Field Repair)</Text>
          <Image source={{ uri: afterPhoto }} style={styles.photo} />
          <View style={styles.metaBox}>
            <Text style={styles.metaClass}>Compacted Asphalt</Text>
            <Text style={styles.metaConf}>Surface Cleared</Text>
          </View>
        </View>
      </View>

      {/* AI Alignment metrics card */}
      <View style={styles.metricsCard}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Geographic & Angle Alignment:</Text>
          <Text style={styles.metricVal}>96% (Verified Coordinates)</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Defect Remediation Score:</Text>
          <Text style={[styles.metricVal, { color: theme.colors.success }]}>
            {similarityScore}% Resolved
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Debris Clearance Check:</Text>
          <Text style={[styles.metricVal, { color: theme.colors.success }]}>PASS</Text>
        </View>
      </View>

      {/* Supervisor action buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.reworkBtn}
          onPress={() => {
            HapticFeedback.heavy();
            Alert.alert('Rework Flagged', 'Returned to field crew with rework notice.');
          }}
        >
          <Icon name="reload" size={16} color={theme.colors.danger} />
          <Text style={styles.reworkText}>Require Rework</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.approveBtn} onPress={handleVerify}>
          <Icon name="checkmark-done" size={18} color="#FFFFFF" />
          <Text style={styles.approveText}>Approve & Close Ticket</Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.xs,
    fontWeight: '800',
  },
  photosGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  photoCol: {
    flex: 1,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
  },
  metaBox: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    padding: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  metaClass: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text,
  },
  metaConf: {
    fontSize: 9,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  metricsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },
  btnRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  reworkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  reworkText: {
    color: theme.colors.danger,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
});
