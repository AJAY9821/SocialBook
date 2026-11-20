import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  type: 'friend_request' | 'like' | 'comment' | 'reply';
  message: string;
  actor: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  post?: {
    id: string;
    content: string;
  };
  isRead?: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount: number;
  friendRequestsCount: number;
  notifications: NotificationItem[];
}

export const notificationsApi = {
  async getNotifications(): Promise<NotificationsResponse> {
    const { data } = await apiClient.get<NotificationsResponse>('/notifications');
    return data;
  },

  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.patch<{ success: boolean }>(
      `/notifications/${notificationId}/read`,
    );
    return data;
  },

  async markAllAsRead(): Promise<{ success: boolean }> {
    const { data } = await apiClient.patch<{ success: boolean }>(
      '/notifications/read-all',
    );
    return data;
  },
};
