import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { HapticFeedback } from '../../utils/haptics';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onPressFilter?: () => void;
  hasActiveFilters?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search tickets, wards, categories...',
  onClear,
  onPressFilter,
  hasActiveFilters,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <Icon name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              HapticFeedback.light();
              onChangeText('');
              onClear?.();
            }}
            style={styles.clearBtn}
          >
            <Icon name="close-circle" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {onPressFilter && (
        <TouchableOpacity
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={() => {
            HapticFeedback.light();
            onPressFilter();
          }}
        >
          <Icon
            name="options-outline"
            size={18}
            color={hasActiveFilters ? '#FFFFFF' : theme.colors.text}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
});
