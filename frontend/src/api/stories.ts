import { apiClient } from './client';
import type {
  StoryAudience,
  StoryItem,
  StoryMediaType,
  StoryViewersResponse,
  UserStoryGroup,
} from '../types';

export interface CreateStoryPayload {
  mediaType: StoryMediaType;
  media?: File;
  caption?: string;
  backgroundColor?: string;
  duration?: number;
  audience?: StoryAudience;
  customUserIds?: string[];
}

export const storiesApi = {
  async getStoriesFeed() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      groups: UserStoryGroup[];
    }>('/stories/feed');
    return data;
  },

  async createStory(payload: CreateStoryPayload) {
    const formData = new FormData();
    formData.append('mediaType', payload.mediaType);
    if (payload.media) {
      formData.append('media', payload.media);
    }
    if (payload.caption) {
      formData.append('caption', payload.caption);
    }
    if (payload.backgroundColor) {
      formData.append('backgroundColor', payload.backgroundColor);
    }
    if (payload.duration !== undefined) {
      formData.append('duration', String(payload.duration));
    }
    if (payload.audience) {
      formData.append('audience', payload.audience);
    }
    if (payload.customUserIds && payload.customUserIds.length > 0) {
      formData.append('customUserIds', JSON.stringify(payload.customUserIds));
    }

    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      story: StoryItem;
    }>('/stories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async markStoryViewed(storyId: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>(`/stories/${storyId}/view`);
    return data;
  },

  async deleteStory(storyId: string) {
    const { data } = await apiClient.delete<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>(`/stories/${storyId}`);
    return data;
  },

  async reactToStory(storyId: string, reaction: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      reaction: string;
    }>(`/stories/${storyId}/react`, { reaction });
    return data;
  },

  async replyToStory(storyId: string, message: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      message: any;
    }>(`/stories/${storyId}/reply`, { message });
    return data;
  },

  async getStoryViewers(storyId: string) {
    const { data } = await apiClient.get<
      { error: boolean; statusCode: number } & StoryViewersResponse
    >(`/stories/${storyId}/viewers`);
    return data;
  },

  async getCloseFriends() {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      closeFriends: Array<{
        id: string;
        name: string;
        email: string;
        avatarUrl?: string;
        bio?: string;
      }>;
    }>('/stories/close-friends');
    return data;
  },

  async updateCloseFriends(closeFriendIds: string[]) {
    const { data } = await apiClient.put<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>('/stories/close-friends', { closeFriendIds });
    return data;
  },
};
