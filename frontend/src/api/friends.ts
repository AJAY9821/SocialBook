import { apiClient } from './client';
import type {
  FriendItem,
  IncomingFriendRequest,
  OutgoingFriendRequest,
} from '../types';

export const friendsApi = {
  async sendRequest(recipientId: string) {
    const { data } = await apiClient.post(`/friends/request/${recipientId}`);
    return data;
  },

  async acceptRequest(requestId: string) {
    const { data } = await apiClient.patch(
      `/friends/request/${requestId}/accept`,
    );
    return data;
  },

  async rejectRequest(requestId: string) {
    const { data } = await apiClient.patch(
      `/friends/request/${requestId}/reject`,
    );
    return data;
  },

  async cancelRequest(requestId: string) {
    const { data } = await apiClient.delete(`/friends/request/${requestId}`);
    return data;
  },

  async getIncomingRequests() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      count: number;
      requests: IncomingFriendRequest[];
    }>('/friends/requests/incoming');
    return data;
  },

  async getOutgoingRequests() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      count: number;
      requests: OutgoingFriendRequest[];
    }>('/friends/requests/outgoing');
    return data;
  },

  async getFriendsList() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      count: number;
      friends: FriendItem[];
    }>('/friends');
    return data;
  },

  async unfriend(friendId: string) {
    const { data } = await apiClient.delete(`/friends/${friendId}`);
    return data;
  },
};
