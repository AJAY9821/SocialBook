import { apiClient } from './client';
import type { User } from '../types';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async register(payload: RegisterPayload) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      user?: User;
    }>('/auth/register', payload);
    return data;
  },

  async login(payload: LoginPayload) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      accessToken: string;
      expiry: string;
      user: User;
    }>('/auth/login', payload);
    return data;
  },

  async getMe() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      user: User;
    }>('/auth/me');
    return data;
  },

  async logout() {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>('/auth/logout');
    return data;
  },
};
