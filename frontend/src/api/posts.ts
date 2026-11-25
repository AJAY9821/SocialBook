import { apiClient } from './client';
import type {
  CommentItem,
  Pagination,
  PopulatedUser,
  Post,
  ReactionType,
} from '../types';

export interface CreatePostPayload {
  content: string;
  image?: File;
  video?: File;
  images?: File[];
  videos?: File[];
  media?: File;
  videoDuration?: number;
}

export interface UpdatePostPayload {
  content?: string;
  image?: File;
  video?: File;
  images?: File[];
  videos?: File[];
  media?: File;
  videoDuration?: number;
}

export const postsApi = {
  async createPost(payload: CreatePostPayload) {
    const formData = new FormData();
    formData.append('content', payload.content);
    if (payload.images && payload.images.length > 0) {
      payload.images.forEach((file) => formData.append('images', file));
    }
    if (payload.image) {
      formData.append('image', payload.image);
    }
    if (payload.videos && payload.videos.length > 0) {
      payload.videos.forEach((file) => formData.append('videos', file));
    }
    if (payload.video) {
      formData.append('video', payload.video);
    }
    if (payload.media && !payload.image && !payload.video) {
      formData.append('media', payload.media);
    }
    if (payload.videoDuration !== undefined) {
      formData.append('videoDuration', String(payload.videoDuration));
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
    if (payload.images && payload.images.length > 0) {
      payload.images.forEach((file) => formData.append('images', file));
    }
    if (payload.image) {
      formData.append('image', payload.image);
    }
    if (payload.videos && payload.videos.length > 0) {
      payload.videos.forEach((file) => formData.append('videos', file));
    }
    if (payload.video) {
      formData.append('video', payload.video);
    }
    if (payload.media && !payload.image && !payload.video) {
      formData.append('media', payload.media);
    }
    if (payload.videoDuration !== undefined) {
      formData.append('videoDuration', String(payload.videoDuration));
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

  async reactToPost(postId: string, reactionType?: ReactionType) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      action: 'created' | 'updated' | 'removed';
      msg: string;
      isLikedByMe: boolean;
      myReaction: ReactionType | null;
      likesCount: number;
    }>(`/likes/${postId}`, { reactionType });
    return data;
  },

  async likePost(postId: string) {
    return this.reactToPost(postId, 'like');
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

  async getPostLikes(
    postId: string,
    page = 1,
    limit = 50,
    reaction?: string,
  ) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      likesCount: number;
      reactionsCount: Record<ReactionType, number>;
      topReactions: ReactionType[];
      likes: {
        id: string;
        user: PopulatedUser;
        reactionType: ReactionType;
        createdAt: string;
      }[];
      pagination: Pagination;
    }>(`/likes/${postId}`, { params: { page, limit, reaction } });
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

  async addComment(
    postId: string,
    content: string,
    parentCommentId?: string,
    gifUrl?: string,
  ) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      comment: CommentItem;
    }>(`/comments/${postId}`, {
      content: content || '',
      parentComment: parentCommentId,
      parentId: parentCommentId,
      gifUrl: gifUrl || undefined,
      commentType: gifUrl ? 'gif' : 'text',
    });
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

  async toggleSavePost(postId: string) {
    const { data } = await apiClient.post<{
      error: boolean;
      statusCode: number;
      msg: string;
      isSaved: boolean;
    }>(`/posts/${postId}/save`);
    return data;
  },

  async getSavedPosts(page = 1, limit = 10) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      posts: Post[];
      pagination: Pagination;
    }>('/posts/saved', { params: { page, limit } });
    return data;
  },

  async getSaveStatus(postId: string) {
    const { data } = await apiClient.get<{
      error: boolean;
      statusCode: number;
      isSaved: boolean;
    }>(`/posts/${postId}/save-status`);
    return data;
  },
};
