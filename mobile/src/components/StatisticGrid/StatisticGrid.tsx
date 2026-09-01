import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';

export interface StatItem {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: string;
  color?: string;
}

export interface StatisticGridProps {
  stats: StatItem[];
  columns?: 2 | 3;
}

export const StatisticGrid: React.FC<StatisticGridProps> = ({ stats, columns = 2 }) => {
  return (
    <View style={styles.grid}>
      {stats.map((item, idx) => (
        <View
          key={idx}
          style={[
            styles.card,
            columns === 3 ? styles.cardCol3 : styles.cardCol2,
          ]}
        >
          <View style={styles.topRow}>
            {item.icon && (
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: item.color ? `${item.color}15` : 'rgba(37, 99, 235, 0.1)' },
                ]}
              >
                <Icon
                  name={item.icon as any}
                  size={16}
                  color={item.color || theme.colors.primary}
                />
              </View>
            )}
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </View>

          <Text style={[styles.value, { color: item.color || theme.colors.text }]}>
            {item.value}
          </Text>

          {item.subValue && <Text style={styles.subValue}>{item.subValue}</Text>}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardCol2: {
    width: '48%',
  },
  cardCol3: {
    width: '31%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    flex: 1,
  },
  value: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '800',
  },
  subValue: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
