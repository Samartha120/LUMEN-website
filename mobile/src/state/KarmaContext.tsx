import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CitizenKarmaSummary, KarmaTransaction, LeaderboardEntry } from '../types/karma.types';
import { KarmaService } from '../services/karma.service';
import { HapticFeedback } from '../utils/haptics';

interface KarmaContextType {
  karmaSummary: CitizenKarmaSummary | null;
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  refreshKarma: () => Promise<void>;
  awardPoints: (
    actionType: KarmaTransaction['actionType'],
    points: number,
    description: string,
    ticketNumber?: string
  ) => Promise<void>;
}

const KarmaContext = createContext<KarmaContextType | null>(null);

export const KarmaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [karmaSummary, setKarmaSummary] = useState<CitizenKarmaSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshKarma = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await KarmaService.getKarmaSummary();
      const board = await KarmaService.getLeaderboard();
      setKarmaSummary(summary);
      setLeaderboard(board);
    } catch (err) {
      console.warn('[KarmaContext] Failed to load karma:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshKarma();
  }, [refreshKarma]);

  const awardPoints = async (
    actionType: KarmaTransaction['actionType'],
    points: number,
    description: string,
    ticketNumber?: string
  ) => {
    HapticFeedback.success();
    const updated = await KarmaService.awardPoints(actionType, points, description, ticketNumber);
    setKarmaSummary(updated);
  };

  return (
    <KarmaContext.Provider
      value={{
        karmaSummary,
        leaderboard,
        loading,
        refreshKarma,
        awardPoints,
      }}
    >
      {children}
    </KarmaContext.Provider>
  );
};

export const useKarma = () => {
  const context = useContext(KarmaContext);
  if (!context) {
    throw new Error('useKarma must be used within a KarmaProvider');
  }
  return context;
};
