/**
 * Notification management & push alert simulation service.
 */

import { StorageService } from './storage.service';

export interface AppNotification {
  id: string;
  type: 'STATUS_UPDATE' | 'HAZARD_ALERT' | 'COMMUNITY_REPLY' | 'KARMA_REWARD' | 'SLA_WARNING';
  title: string;
  body: string;
  relatedId?: string; // ticketNumber or postId
  isRead: boolean;
  timestamp: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
}

const NOTIFICATIONS_CACHE_KEY = 'app_notifications_list';

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    type: 'HAZARD_ALERT',
    title: '⚠️ Critical Alert in your Home Zone',
    body: 'Live cable snap reported on 12th Cross near Shanthi Nagar. Power isolation crew deployed.',
    relatedId: 'LMN-EMG-101',
    isRead: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    priority: 'URGENT',
  },
  {
    id: 'notif-2',
    type: 'STATUS_UPDATE',
    title: 'Repair Crew Arrived On Site',
    body: 'Asphalt patching van has arrived at 8th Main Junction for ticket #LMN-8021.',
    relatedId: 'LMN-8021',
    isRead: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    priority: 'HIGH',
  },
  {
    id: 'notif-3',
    type: 'KARMA_REWARD',
    title: '🎉 +1,000 Karma Points Awarded!',
    body: 'You unlocked the "Ward Safety Sentinel" badge for reporting high-priority civic hazards.',
    isRead: true,
    timestamp: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
    priority: 'NORMAL',
  },
  {
    id: 'notif-4',
    type: 'COMMUNITY_REPLY',
    title: 'Official Response on your Post',
    body: 'Engineer Suresh Babu commented on your 8th Main Junction pothole report.',
    relatedId: 'post-101',
    isRead: true,
    timestamp: new Date(Date.now() - 1000 * 3600 * 26).toISOString(),
    priority: 'NORMAL',
  },
];

export class NotificationService {
  /**
   * Get all user notifications
   */
  static async getNotifications(): Promise<AppNotification[]> {
    const notifs = await StorageService.getItem<AppNotification[]>(NOTIFICATIONS_CACHE_KEY);
    if (!notifs) {
      await StorageService.setItem(NOTIFICATIONS_CACHE_KEY, INITIAL_NOTIFICATIONS);
      return INITIAL_NOTIFICATIONS;
    }
    return notifs;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id: string): Promise<AppNotification[]> {
    const notifs = await this.getNotifications();
    const target = notifs.find(n => n.id === id);
    if (target) {
      target.isRead = true;
      await StorageService.setItem(NOTIFICATIONS_CACHE_KEY, notifs);
    }
    return notifs;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<AppNotification[]> {
    const notifs = await this.getNotifications();
    notifs.forEach(n => (n.isRead = true));
    await StorageService.setItem(NOTIFICATIONS_CACHE_KEY, notifs);
    return notifs;
  }

  /**
   * Push a new notification into the user inbox
   */
  static async pushNotification(notif: Omit<AppNotification, 'id' | 'isRead' | 'timestamp'>): Promise<AppNotification> {
    const notifs = await this.getNotifications();
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      isRead: false,
      timestamp: new Date().toISOString(),
    };

    notifs.unshift(newNotif);
    await StorageService.setItem(NOTIFICATIONS_CACHE_KEY, notifs);
    return newNotif;
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(): Promise<number> {
    const notifs = await this.getNotifications();
    return notifs.filter(n => !n.isRead).length;
  }
}
