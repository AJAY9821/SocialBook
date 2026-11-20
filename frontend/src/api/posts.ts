import { apiClient } from './client';
import type { CommentItem, Pagination, Post } from '../types';

export interface CreatePostPayload {
  content: string;
  image?: File;
}

export interface UpdatePostPayload {
  content?: string;
  image?: File;
}

export const postsApi = {
  async createPost(payload: CreatePostPayload) {
    const formData = new FormData();
    formData.append('content', payload.content);
    if (payload.image) {
      formData.append('image', payload.image);
    }

    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      post: Post;
    }>('/posts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async getFeed(page = 1, limit = 10) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      posts: Post[];
      pagination: Pagination;
    }>('/posts/feed', { params: { page, limit } });
    return data;
  },

  async getUserPosts(userId: string, page = 1, limit = 10) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      posts: Post[];
      pagination: Pagination;
    }>(`/posts/user/${userId}`, { params: { page, limit } });
    return data;
  },

  async getPostById(postId: string) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      post: Post;
    }>(`/posts/${postId}`);
    return data;
  },

  async updatePost(postId: string, payload: UpdatePostPayload) {
    const formData = new FormData();
    if (payload.content !== undefined) {
      formData.append('content', payload.content);
    }
    if (payload.image) {
      formData.append('image', payload.image);
    }

    const { data } = await apiClient.patch<{
      error: boolean;
      statusCode: number;
      msg: string;
      post: Post;
    }>(`/posts/${postId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async deletePost(postId: string) {
    const { data } = await apiClient.delete<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>(`/posts/${postId}`);
    return data;
  },

  async likePost(postId: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      likesCount: number;
    }>(`/likes/${postId}`);
    return data;
  },

  async unlikePost(postId: string) {
    const { data } = await apiClient.delete<{
      error: boolean;
      statusCode: number;
      msg: string;
      likesCount: number;
    }>(`/likes/${postId}`);
    return data;
  },

  async getComments(postId: string, page = 1, limit = 20) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      comments: CommentItem[];
      pagination: Pagination;
    }>(`/comments/${postId}`, { params: { page, limit } });
    return data;
  },

  async addComment(postId: string, content: string, parentId?: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      comment: CommentItem;
    }>(`/comments/${postId}`, { content, parentId });
    return data;
  },

  async updateComment(commentId: string, content: string) {
    const { data } = await apiClient.patch<{
      error: boolean;
      statusCode: number;
      msg: string;
      comment: CommentItem;
    }>(`/comments/${commentId}`, { content });
    return data;
  },

  async deleteComment(commentId: string) {
    const { data } = await apiClient.delete<{
      error: boolean;
      statusCode: number;
      msg: string;
    }>(`/comments/${commentId}`);
    return data;
  },

  async sharePost(postId: string, caption?: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      post: Post;
    }>(`/posts/${postId}/share`, { caption });
    return data;
  },

  async incrementShareCount(postId: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      sharesCount: number;
    }>(`/posts/${postId}/share-count`);
    return data;
  },
};
