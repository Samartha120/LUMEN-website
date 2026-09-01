import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { WardBudgetAllocation } from '../../types/budget.types';
import { formatCategoryName } from '../../utils/string';

export interface BudgetBreakdownChartProps {
  budget: WardBudgetAllocation;
}

export const BudgetBreakdownChart: React.FC<BudgetBreakdownChartProps> = ({ budget }) => {
  const formatInrCr = (amount: number) => {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'roads':
        return '#F59E0B';
      case 'electrical':
        return '#EF4444';
      case 'water':
        return '#3B82F6';
      case 'waste':
        return '#10B981';
      default:
        return '#8B5CF6';
    }
  };

  const totalUtilization = Math.round((budget.totalSpentInr / budget.totalBudgetInr) * 100);

  return (
    <View style={styles.container}>
      {/* Overview Top Card */}
      <View style={styles.topCard}>
        <View>
          <Text style={styles.topLabel}>{budget.wardNumber} Total Public Allocation</Text>
          <Text style={styles.totalVal}>{formatInrCr(budget.totalBudgetInr)}</Text>
        </View>

        <View style={styles.utilBox}>
          <Text style={styles.utilVal}>{totalUtilization}%</Text>
          <Text style={styles.utilLabel}>Utilized</Text>
        </View>
      </View>

      {/* Progress track */}
      <View style={styles.totalTrack}>
        <View style={[styles.totalFill, { width: `${totalUtilization}%` }]} />
      </View>

      {/* Category breakdown bars */}
      <Text style={styles.breakdownHeader}>Expenditure by Civic Category</Text>
      <View style={styles.categoryList}>
        {Object.entries(budget.breakdownByCategory).map(([cat, data]) => {
          const catUtil = Math.round((data.spentInr / data.allocatedInr) * 100);
          const color = getCategoryColor(cat);

          return (
            <View key={cat} style={styles.catItem}>
              <View style={styles.catRow}>
                <View style={styles.catNameBox}>
                  <View style={[styles.colorDot, { backgroundColor: color }]} />
                  <Text style={styles.catName}>{formatCategoryName(cat)}</Text>
                </View>
                <Text style={styles.catAmount}>
                  {formatInrCr(data.spentInr)} / {formatInrCr(data.allocatedInr)}
                </Text>
              </View>

              <View style={styles.catTrack}>
                <View
                  style={[
                    styles.catFill,
                    { width: `${catUtil}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  topCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  totalVal: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 2,
  },
  utilBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.md,
  },
  utilVal: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  utilLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  totalTrack: {
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  totalFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  breakdownHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  categoryList: {
    gap: 8,
  },
  catItem: {
    gap: 4,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catNameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  catAmount: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  catTrack: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  catFill: {
    height: '100%',
  },
});
