import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { HazardBroadcast, GeofenceSubscription } from '../types/emergency.types';
import { EmergencyService } from '../services/emergency.service';
import { HapticFeedback } from '../utils/haptics';

interface EmergencyAlertContextType {
  hazards: Array<HazardBroadcast & { distanceMeters?: number }>;
  subscriptions: GeofenceSubscription[];
  loading: boolean;
  activeCount: number;
  refreshHazards: () => Promise<void>;
  acknowledgeHazard: (hazardId: string) => Promise<void>;
  saveSubscription: (sub: GeofenceSubscription) => Promise<void>;
}

const EmergencyAlertContext = createContext<EmergencyAlertContextType | null>(null);

export const EmergencyAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hazards, setHazards] = useState<Array<HazardBroadcast & { distanceMeters?: number }>>([]);
  const [subscriptions, setSubscriptions] = useState<GeofenceSubscription[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshHazards = useCallback(async () => {
    setLoading(true);
    try {
      const userCoord = { latitude: 12.9716, longitude: 77.5946 };
      const data = await EmergencyService.getActiveHazards(userCoord);
      const subs = await EmergencyService.getGeofenceSubscriptions();
      setHazards(data);
      setSubscriptions(subs);
    } catch (err) {
      console.warn('[EmergencyAlertContext] Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHazards();
  }, [refreshHazards]);

  const acknowledgeHazard = async (hazardId: string) => {
    HapticFeedback.light();
    await EmergencyService.acknowledgeHazard(hazardId);
    setHazards(prev =>
      prev.map(h => (h.id === hazardId ? { ...h, hasUserAcknowledged: true } : h))
    );
  };

  const saveSubscription = async (sub: GeofenceSubscription) => {
    HapticFeedback.medium();
    const updated = await EmergencyService.saveGeofenceSubscription(sub);
    setSubscriptions(updated);
  };

  const activeCount = hazards.filter(h => !h.hasUserAcknowledged).length;

  return (
    <EmergencyAlertContext.Provider
      value={{
        hazards,
        subscriptions,
        loading,
        activeCount,
        refreshHazards,
        acknowledgeHazard,
        saveSubscription,
      }}
    >
      {children}
    </EmergencyAlertContext.Provider>
  );
};

export const useEmergencyAlerts = () => {
  const context = useContext(EmergencyAlertContext);
  if (!context) {
    throw new Error('useEmergencyAlerts must be used within an EmergencyAlertProvider');
  }
  return context;
};
