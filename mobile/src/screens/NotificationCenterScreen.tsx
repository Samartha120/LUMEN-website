import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { useNotifications } from '../state/NotificationContext';
import { formatRelativeTime } from '../utils/date';
import { HapticFeedback } from '../utils/haptics';

export const NotificationCenterScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { notifications, unreadCount, loading, refreshNotifications, markAsRead, markAllAsRead } =
    useNotifications();

  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const displayedList = filterUnreadOnly
    ? notifications.filter(n => !n.isRead)
    : notifications;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshNotifications} />}
    >
      {/* Header bar */}
      <View style={styles.topBar}>
        <View style={styles.unreadTag}>
          <Text style={styles.unreadText}>{unreadCount} Unread Alerts</Text>
        </View>

        <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
          <Icon name="checkmark-done" size={16} color={theme.colors.primary} />
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications list */}
      <View style={styles.list}>
        {displayedList.map(notif => {
          const isUrgent = notif.priority === 'URGENT';
          return (
            <TouchableOpacity
              key={notif.id}
              style={[
                styles.card,
                !notif.isRead && styles.cardUnread,
                isUrgent && styles.cardUrgent,
              ]}
              onPress={() => {
                HapticFeedback.light();
                markAsRead(notif.id);
                if (notif.type === 'STATUS_UPDATE') {
                  navigation?.navigate?.('LiveTracking', { complaintId: notif.relatedId || 'cmp-001' });
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                  <Icon
                    name={
                      notif.type === 'HAZARD_ALERT'
                        ? 'warning'
                        : notif.type === 'KARMA_REWARD'
                        ? 'trophy'
                        : 'notifications'
                    }
                    size={14}
                    color={
                      notif.type === 'HAZARD_ALERT'
                        ? theme.colors.danger
                        : theme.colors.primary
                    }
                  />
                  <Text style={styles.typeText}>{notif.type.replace('_', ' ')}</Text>
                </View>

                <Text style={styles.timeText}>{formatRelativeTime(notif.timestamp)}</Text>
              </View>

              <Text style={styles.title}>{notif.title}</Text>
              <Text style={styles.body}>{notif.body}</Text>
            </TouchableOpacity>
          );
        })}

        {displayedList.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="mail-open-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>All caught up! No notifications right now.</Text>
          </View>
        )}
      </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  unreadTag: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  list: {
    gap: 8,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardUnread: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.03)',
  },
  cardUrgent: {
    borderColor: theme.colors.danger,
    backgroundColor: '#FEF2F2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  timeText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  title: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  body: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
});
