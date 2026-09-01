import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { FieldToolkitService } from '../../services/fieldToolkit.service';
import { MaterialCalculationResult, RepairDimensionInput } from '../../types/fieldToolkit.types';
import { HapticFeedback } from '../../utils/haptics';

export const MaterialCalculator: React.FC = () => {
  const [length, setLength] = useState('2.5');
  const [width, setWidth] = useState('1.8');
  const [depth, setDepth] = useState('12');
  const [roadType, setRoadType] = useState<RepairDimensionInput['roadType']>('RESIDENTIAL_LOCAL');
  const [result, setResult] = useState<MaterialCalculationResult | null>(() => {
    return FieldToolkitService.calculateRepairMaterials({
      lengthMeters: 2.5,
      widthMeters: 1.8,
      depthCentimeters: 12,
      roadType: 'RESIDENTIAL_LOCAL',
      subBaseCondition: 'SOLID',
    });
  });

  const handleCalculate = () => {
    HapticFeedback.light();
    const res = FieldToolkitService.calculateRepairMaterials({
      lengthMeters: parseFloat(length) || 1.0,
      widthMeters: parseFloat(width) || 1.0,
      depthCentimeters: parseFloat(depth) || 5.0,
      roadType,
      subBaseCondition: 'SOLID',
    });
    setResult(res);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Asphalt & Civil Material Estimator</Text>
      <Text style={styles.headerSubtitle}>
        Engineering calculation with 18% compaction loss surcharge & tack coat
      </Text>

      {/* Input dimension fields */}
      <View style={styles.inputsRow}>
        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Length (m)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={length}
            onChangeText={v => {
              setLength(v);
              handleCalculate();
            }}
          />
        </View>

        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Width (m)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={width}
            onChangeText={v => {
              setWidth(v);
              handleCalculate();
            }}
          />
        </View>

        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Depth (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={depth}
            onChangeText={v => {
              setDepth(v);
              handleCalculate();
            }}
          />
        </View>
      </View>

      {/* Road traffic type selector */}
      <View style={styles.typeSelector}>
        {(['RESIDENTIAL_LOCAL', 'ARTERIAL_HEAVY_TRAFFIC'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.typePill, roadType === t && styles.typePillActive]}
            onPress={() => {
              setRoadType(t);
              handleCalculate();
            }}
          >
            <Text style={[styles.typeText, roadType === t && styles.typeTextActive]}>
              {t === 'ARTERIAL_HEAVY_TRAFFIC' ? 'Arterial Corridor (+15% Compaction)' : 'Residential Local Road'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Calculated Results Card */}
      {result && (
        <View style={styles.resultsCard}>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Surface Area</Text>
              <Text style={styles.kpiVal}>{result.surfaceAreaSqm} m²</Text>
            </View>

            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Asphalt Hot-Mix</Text>
              <Text style={[styles.kpiVal, { color: theme.colors.primary }]}>
                {result.asphaltTonnageRequired} T
              </Text>
            </View>

            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Tack Coat (RS-1)</Text>
              <Text style={styles.kpiVal}>{result.tackCoatLitresRequired} L</Text>
            </View>

            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Estimated Labor</Text>
              <Text style={styles.kpiVal}>{result.estimatedCrewHours} hrs</Text>
            </View>
          </View>

          {/* Material breakdown bill of quantities */}
          <Text style={styles.boqHeader}>Material Requisition Breakdown</Text>
          {result.materialBreakdown.map((item, idx) => (
            <View key={idx} style={styles.boqRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.matName}>{item.materialName}</Text>
                <Text style={styles.matQty}>
                  Quantity: {item.quantity} {item.unit}
                </Text>
              </View>
              <Text style={styles.matCost}>₹{item.estimatedCostInr.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
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
  headerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  typeSelector: {
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  typePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  typePillActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: theme.colors.primary,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  typeTextActive: {
    color: theme.colors.primary,
  },
  resultsCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  kpiBox: {
    width: '48%',
    backgroundColor: theme.colors.card,
    padding: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kpiLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  kpiVal: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2,
  },
  boqHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  boqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matName: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  matQty: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  matCost: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
  },
});
