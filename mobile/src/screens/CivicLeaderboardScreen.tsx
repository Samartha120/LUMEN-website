import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { useKarma } from '../state/KarmaContext';
import { KarmaBadge } from '../components/KarmaBadge';
import { StatisticGrid } from '../components/StatisticGrid';
import { HapticFeedback } from '../utils/haptics';

export const CivicLeaderboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { karmaSummary, leaderboard, loading, refreshKarma } = useKarma();
  const [tab, setTab] = useState<'LEADERBOARD' | 'BADGES' | 'HISTORY'>('LEADERBOARD');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshKarma} />}
    >
      {/* Top Karma Profile Card */}
      {karmaSummary && (
        <View style={styles.karmaCard}>
          <View style={styles.karmaHeader}>
            <View>
              <Text style={styles.karmaPointsVal}>{karmaSummary.totalPoints.toLocaleString()}</Text>
              <Text style={styles.karmaPointsLabel}>Civic Karma Score</Text>
            </View>

            <View style={styles.tierBox}>
              <Icon name="shield-checkmark" size={16} color="#F59E0B" />
              <Text style={styles.tierName}>{karmaSummary.currentTier.replace('_', ' ')}</Text>
            </View>
          </View>

          {/* Streak tracker */}
          <View style={styles.streakRow}>
            <Icon name="flame" size={18} color="#EF4444" />
            <Text style={styles.streakText}>
              {karmaSummary.currentStreakDays} Day Active Contribution Streak!
            </Text>
          </View>
        </View>
      )}

      {/* Segmented Tab Switcher */}
      <View style={styles.tabsStrip}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'LEADERBOARD' && styles.tabBtnActive]}
          onPress={() => {
            HapticFeedback.light();
            setTab('LEADERBOARD');
          }}
        >
          <Text style={[styles.tabBtnText, tab === 'LEADERBOARD' && styles.tabBtnTextActive]}>
            Leaderboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'BADGES' && styles.tabBtnActive]}
          onPress={() => {
            HapticFeedback.light();
            setTab('BADGES');
          }}
        >
          <Text style={[styles.tabBtnText, tab === 'BADGES' && styles.tabBtnTextActive]}>
            Badges & Trophies
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'HISTORY' && styles.tabBtnActive]}
          onPress={() => {
            HapticFeedback.light();
            setTab('HISTORY');
          }}
        >
          <Text style={[styles.tabBtnText, tab === 'HISTORY' && styles.tabBtnTextActive]}>
            Activity History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Leaderboard */}
      {tab === 'LEADERBOARD' && (
        <View style={styles.leaderboardList}>
          {leaderboard.map(entry => (
            <View
              key={entry.rank}
              style={[styles.leaderRow, entry.isCurrentUser && styles.currentUserRow]}
            >
              <View
                style={[
                  styles.rankCircle,
                  entry.rank === 1
                    ? styles.rankGold
                    : entry.rank === 2
                    ? styles.rankSilver
                    : entry.rank === 3
                    ? styles.rankBronze
                    : styles.rankNormal,
                ]}
              >
                <Text style={styles.rankNum}>{entry.rank}</Text>
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>{entry.name}</Text>
                <Text style={styles.userWard}>{entry.wardName} • {entry.resolvedCount} solved</Text>
              </View>

              <Text style={styles.pointsScore}>{entry.points} pts</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tab 2: Badges */}
      {tab === 'BADGES' && karmaSummary && (
        <View style={styles.badgeGallery}>
          {karmaSummary.badges.map(badge => (
            <KarmaBadge key={badge.id} badge={badge} />
          ))}
        </View>
      )}

      {/* Tab 3: History */}
      {tab === 'HISTORY' && karmaSummary && (
        <View style={styles.historyList}>
          {karmaSummary.recentTransactions.map(tx => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txIconBox}>
                <Icon name="add-circle" size={20} color={theme.colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txTime}>
                  {new Date(tx.timestamp).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.txPoints}>+{tx.points}</Text>
            </View>
          ))}
        </View>
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
  karmaCard: {
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  karmaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  karmaPointsVal: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  karmaPointsLabel: {
    fontSize: theme.typography.sizes.xs,
    color: '#94A3B8',
    fontWeight: '600',
  },
  tierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  tierName: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  streakText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  tabsStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: theme.radius.md,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  leaderboardList: {
    gap: 8,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  currentUserRow: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankGold: {
    backgroundColor: '#F59E0B',
  },
  rankSilver: {
    backgroundColor: '#94A3B8',
  },
  rankBronze: {
    backgroundColor: '#B45309',
  },
  rankNormal: {
    backgroundColor: theme.colors.background,
  },
  rankNum: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  userWard: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  pointsScore: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  badgeGallery: {
    gap: 8,
  },
  historyList: {
    gap: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
  txTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  txPoints: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.success,
  },
});
