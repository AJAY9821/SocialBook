import { apiClient } from './client';

export interface ChatUserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface ChatMessage {
  id: string;
  sender: ChatUserSummary;
  recipient: ChatUserSummary;
  content: string;
  messageType?: 'text' | 'audio';
  audioUrl?: string;
  audioDuration?: number;
  audioWaveform?: number[];
  isRead: boolean;
  readAt?: string;
  isMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationItem {
  friend: ChatUserSummary;
  latestMessage: {
    id: string;
    content: string;
    messageType?: 'text' | 'audio';
    audioUrl?: string;
    audioDuration?: number;
    senderId: string;
    isMe: boolean;
    isRead: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastActivityAt: string;
}

export interface ConversationsResponse {
  error: boolean;
  statusCode: number;
  conversations: ConversationItem[];
}

export interface ChatHistoryResponse {
  error: boolean;
  statusCode: number;
  friend: ChatUserSummary;
  messages: ChatMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isBlockedByMe?: boolean;
  isBlockedByOther?: boolean;
  isBlocked?: boolean;
}

export interface SendMessagePayload {
  recipientId: string;
  content: string;
}

export const chatApi = {
  async getConversations(): Promise<ConversationsResponse> {
    const res = await apiClient.get<ConversationsResponse>('/chat/conversations');
    return res.data;
  },

  async getChatHistory(
    friendId: string,
    page = 1,
    limit = 50,
  ): Promise<ChatHistoryResponse> {
    const res = await apiClient.get<ChatHistoryResponse>(
      `/chat/messages/${friendId}`,
      { params: { page, limit } },
    );
    return res.data;
  },

  async sendMessage(payload: SendMessagePayload): Promise<{
    error: boolean;
    statusCode: number;
    msg: string;
    message: ChatMessage;
  }> {
    const res = await apiClient.post('/chat/messages', payload);
    return res.data;
  },

  async sendAudioMessage(
    recipientId: string,
    audioBlob: Blob,
    duration: number,
    waveform?: number[],
  ): Promise<{
    error: boolean;
    statusCode: number;
    msg: string;
    message: ChatMessage;
  }> {
    const formData = new FormData();
    formData.append('recipientId', recipientId);
    formData.append('duration', String(duration));
    if (waveform && waveform.length > 0) {
      formData.append('waveform', JSON.stringify(waveform));
    }
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('audio', audioBlob, `voice-note.${ext}`);

    const res = await apiClient.post('/chat/messages/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async markAsRead(friendId: string): Promise<{ error: boolean; msg: string }> {
    const res = await apiClient.patch(`/chat/messages/${friendId}/read`);
    return res.data;
  },

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const res = await apiClient.get<{ unreadCount: number }>('/chat/unread-count');
    return res.data;
  },
};
