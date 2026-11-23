import { apiClient } from './client';
import type { BlockedUserItem } from '../types';

export const blocksApi = {
  async blockUser(userId: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>(`/blocks/${userId}`);
    return data;
  },

  async unblockUser(userId: string) {
    const { data } = await apiClient.delete<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>(`/blocks/${userId}`);
    return data;
  },

  async getBlockedUsers() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      count: number;
      blockedUsers: BlockedUserItem[];
    }>('/blocks');
    return data;
  },

  async getBlockStatus(userId: string) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      isBlockedByMe: boolean;
      isBlockedByOther: boolean;
      isBlocked: boolean;
    }>(`/blocks/status/${userId}`);
    return data;
  },
};
