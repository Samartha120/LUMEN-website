import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppNotification, NotificationService } from '../services/notifications.service';
import { HapticFeedback } from '../utils/haptics';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendLocalNotification: (notif: Omit<AppNotification, 'id' | 'isRead' | 'timestamp'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const list = await NotificationService.getNotifications();
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.isRead).length);
    } catch (err) {
      console.warn('[NotificationContext] Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markAsRead = async (id: string) => {
    const updated = await NotificationService.markAsRead(id);
    setNotifications(updated);
    setUnreadCount(updated.filter(n => !n.isRead).length);
  };

  const markAllAsRead = async () => {
    HapticFeedback.light();
    const updated = await NotificationService.markAllAsRead();
    setNotifications(updated);
    setUnreadCount(0);
  };

  const sendLocalNotification = async (notif: Omit<AppNotification, 'id' | 'isRead' | 'timestamp'>) => {
    HapticFeedback.medium();
    const created = await NotificationService.pushNotification(notif);
    setNotifications(prev => [created, ...prev]);
    setUnreadCount(count => count + 1);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        sendLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
