import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  type: 'friend_request' | 'like' | 'comment';
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
};
