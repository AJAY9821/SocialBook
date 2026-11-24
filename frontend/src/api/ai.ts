import { apiClient } from './client';

export type PolishTone =
  | 'fix_grammar'
  | 'professional'
  | 'engaging'
  | 'casual'
  | 'short';

export interface PolishResponse {
  error: boolean;
  statusCode: number;
  polishedContent: string;
  explanation: string;
  suggestedHashtags: string[];
  isAiPowered: boolean;
}

export interface HashtagsResponse {
  error: boolean;
  statusCode: number;
  hashtags: string[];
  isAiPowered: boolean;
}

export interface CaptionResponse {
  error: boolean;
  statusCode: number;
  captions: string[];
  hashtags: string[];
  isAiPowered: boolean;
}

export const aiApi = {
  async polishContent(content: string, tone: PolishTone, includeEmojis = true) {
    const { data } = await apiClient.post<PolishResponse>('/ai/polish', {
      content,
      tone,
      includeEmojis,
    });
    return data;
  },

  async generateHashtags(content: string, limit = 8) {
    const { data } = await apiClient.post<HashtagsResponse>('/ai/hashtags', {
      content,
      limit,
    });
    return data;
  },

  async generateCaption(
    prompt: string,
    style: 'short' | 'story' | 'inquisitive' = 'short',
  ) {
    const { data } = await apiClient.post<CaptionResponse>(
      '/ai/generate-caption',
      {
        prompt,
        style,
      },
    );
    return data;
  },
};
