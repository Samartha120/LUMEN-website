import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { SafeRouteMap } from '../components/SafeRouteMap';
import { CivicRouteOption, RoutePreference } from '../types/route.types';
import { RouteService } from '../services/route.service';
import { HapticFeedback } from '../utils/haptics';

export const SafeRouteScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [routes, setRoutes] = useState<CivicRouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-well-lit');
  const [travelMode, setTravelMode] = useState<'WALKING' | 'TWO_WHEELER' | 'DRIVING'>('WALKING');
  const [loading, setLoading] = useState(false);

  const calculateRoutes = async () => {
    setLoading(true);
    try {
      const data = await RouteService.calculateSafeRoutes({
        origin: { latitude: 12.9716, longitude: 77.5946 },
        destination: { latitude: 12.9780, longitude: 77.6400 },
        preference: 'SAFEST_WELL_LIT',
        travelMode,
        avoidWaterloggedZones: true,
        avoidUnlitStreets: true,
      });
      setRoutes(data);
      if (data.length > 0) setSelectedRouteId(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateRoutes();
  }, [travelMode]);

  const handleStartNav = (route: CivicRouteOption) => {
    Alert.alert(
      'Safe Navigation Started 🚀',
      `Guiding via ${route.title}.\n\nTurn-by-turn guidance active. Hazards along the path will be announced in advance.`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Origin / Destination Search Card */}
      <View style={styles.searchCard}>
        <View style={styles.locationRow}>
          <View style={styles.dotOrigin} />
          <Text style={styles.locationInputText}>Current Location (Indiranagar 8th Main)</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.locationRow}>
          <View style={styles.dotDest} />
          <Text style={styles.locationInputText}>Indiranagar Metro Station (HAL 2nd Stage)</Text>
        </View>

        {/* Travel Mode Pills */}
        <View style={styles.modesRow}>
          {[
            { id: 'WALKING', label: 'Walk', icon: 'walk' },
            { id: 'TWO_WHEELER', label: 'Two-Wheeler', icon: 'bicycle' },
            { id: 'DRIVING', label: 'Drive', icon: 'car' },
          ].map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeBtn, travelMode === m.id && styles.modeBtnActive]}
              onPress={() => {
                HapticFeedback.light();
                setTravelMode(m.id as any);
              }}
            >
              <Icon
                name={m.icon as any}
                size={14}
                color={travelMode === m.id ? '#FFFFFF' : theme.colors.textMuted}
              />
              <Text style={[styles.modeText, travelMode === m.id && styles.modeTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Routes Map Component */}
      {routes.length > 0 && (
        <SafeRouteMap
          routes={routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={id => setSelectedRouteId(id)}
          onStartNavigation={handleStartNav}
        />
      )}
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
  searchCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  dotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  dotDest: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: theme.colors.success,
  },
  locationInputText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.background,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
});
