import { apiClient } from './client';
import type { User } from '../types';

export interface UpdateProfilePayload {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export const usersApi = {
  async getMyProfile() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      user: User;
    }>('/users/profile');
    return data;
  },

  async updateMyProfile(payload: UpdateProfilePayload) {
    const { data } = await apiClient.patch<{
      error: boolean;
      statusCode: number;
      msg: string;
      user: User;
    }>('/users/profile', payload);
    return data;
  },

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      user: User;
    }>('/users/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async uploadCover(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      user: User;
    }>('/users/profile/cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async searchUsers(query: string) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      users: User[];
    }>('/users/search', { params: { q: query } });
    return data;
  },

  async getUserById(userId: string) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      user: User;
    }>(`/users/${userId}`);
    return data;
  },
};
