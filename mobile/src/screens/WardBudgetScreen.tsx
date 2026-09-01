import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { BudgetBreakdownChart } from '../components/BudgetBreakdownChart';
import { WardBudgetAllocation, ExpenditureProject } from '../types/budget.types';
import { BudgetService } from '../services/budget.service';
import { HapticFeedback } from '../utils/haptics';

export const WardBudgetScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [budget, setBudget] = useState<WardBudgetAllocation | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await BudgetService.getWardBudget('Ward 112');
      setBudget(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerify = async (project: ExpenditureProject) => {
    HapticFeedback.success();
    await BudgetService.verifyProject(project.id);
    await loadData();
    Alert.alert(
      'Citizen Audit Verified! 🏛️',
      `You verified progress on "${project.title}". +50 Civic Karma points awarded for community audit participation.`
    );
  };

  if (!budget) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading ward budget audit records...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      {/* Top Chart Breakdown */}
      <BudgetBreakdownChart budget={budget} />

      {/* Major Ward Works & Projects List */}
      <Text style={styles.sectionHeader}>Major Capital Works & Contractor Registry</Text>
      <View style={styles.projectsList}>
        {budget.activeProjects.map(proj => (
          <View key={proj.id} style={styles.projectCard}>
            <View style={styles.projHeader}>
              <Text style={styles.projCode}>{proj.projectCode}</Text>
              <View
                style={[
                  styles.statusTag,
                  proj.status === 'COMPLETED' ? styles.statusTagDone : styles.statusTagProgress,
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    proj.status === 'COMPLETED' ? styles.statusTextDone : styles.statusTextProgress,
                  ]}
                >
                  {proj.status.replace('_', ' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.projTitle}>{proj.title}</Text>

            <View style={styles.contractorBox}>
              <View style={styles.contractorAvatar}>
                <Icon name="business" size={16} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contractorName}>{proj.contractorName}</Text>
                <Text style={styles.contractorRating}>
                  ★ {proj.contractorRating.toFixed(1)} Public Contractor Rating
                </Text>
              </View>
            </View>

            {/* Financial allocation bar */}
            <View style={styles.costRow}>
              <Text style={styles.costText}>
                Spent: ₹{(proj.spentToDateInr / 100000).toFixed(1)} L / Allocated: ₹
                {(proj.allocatedBudgetInr / 100000).toFixed(1)} L
              </Text>
              <Text style={styles.costPercent}>
                {Math.round((proj.spentToDateInr / proj.allocatedBudgetInr) * 100)}%
              </Text>
            </View>

            <Text style={styles.auditNotes}>
              <Text style={styles.auditBold}>Quality Audit:</Text> {proj.auditNotes}
            </Text>

            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => handleVerify(proj)}
            >
              <Icon name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.verifyBtnText}>
                Verify Site Progress ({proj.citizenVerificationCount} audits)
              </Text>
            </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  sectionHeader: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  projectsList: {
    gap: 10,
  },
  projectCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  projHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projCode: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  statusTagProgress: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  statusTagDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusTextProgress: {
    color: theme.colors.primary,
  },
  statusTextDone: {
    color: theme.colors.success,
  },
  projTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 20,
    marginVertical: 4,
  },
  contractorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.background,
    padding: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: 6,
  },
  contractorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractorName: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  contractorRating: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '700',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  costText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  costPercent: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
  },
  auditNotes: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
    marginVertical: 6,
  },
  auditBold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    marginTop: 4,
  },
  verifyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
