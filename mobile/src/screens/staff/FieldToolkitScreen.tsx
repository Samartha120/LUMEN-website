import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { MaterialCalculator } from '../../components/MaterialCalculator';

export const FieldToolkitScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Banner */}
      <View style={styles.banner}>
        <View style={styles.iconBox}>
          <Icon name="construct" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Field Engineer Diagnostic & Material Suite</Text>
        <Text style={styles.desc}>
          Standardized PWD / IRC civil rate cards, asphalt volume estimators, and material requisitions.
        </Text>
      </View>

      {/* Material calculation widget */}
      <MaterialCalculator />

      {/* Requisition Action */}
      <TouchableOpacity
        style={styles.requisitionBtn}
        onPress={() => {
          Alert.alert(
            'Material Requisition Dispatched',
            'Hot-mix asphalt batch order submitted to Central Asphalt Plant depot.'
          );
        }}
      >
        <Icon name="cube" size={18} color="#FFFFFF" />
        <Text style={styles.requisitionText}>Submit Material Requisition to Depot</Text>
      </TouchableOpacity>
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
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  desc: {
    fontSize: theme.typography.sizes.xs,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  requisitionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
  },
  requisitionText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
});
