import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { HapticFeedback } from '../../utils/haptics';

export interface FilterOption<T = string> {
  id: T;
  label: string;
  icon?: string;
  count?: number;
}

export interface FilterPillProps<T = string> {
  options: FilterOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
}

export function FilterPill<T = string>({ options, selectedId, onSelect }: FilterPillProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map(opt => {
        const isSelected = opt.id === selectedId;
        return (
          <TouchableOpacity
            key={String(opt.id)}
            style={[styles.pill, isSelected && styles.pillActive]}
            onPress={() => {
              HapticFeedback.light();
              onSelect(opt.id);
            }}
            activeOpacity={0.7}
          >
            {opt.icon && (
              <Icon
                name={opt.icon as any}
                size={14}
                color={isSelected ? '#FFFFFF' : theme.colors.textMuted}
              />
            )}
            <Text style={[styles.label, isSelected && styles.labelActive]}>{opt.label}</Text>
            {opt.count !== undefined && (
              <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                <Text style={[styles.countText, isSelected && styles.countTextActive]}>
                  {opt.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  countTextActive: {
    color: '#FFFFFF',
  },
});
