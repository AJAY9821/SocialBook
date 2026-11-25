export interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  location?: string;
  website?: string;
  isEmailVerified: boolean;
  isAccountCompleted: boolean;
  isDeleted: boolean;
  role: 'admin' | 'user';
  isBlockedByMe?: boolean;
  isBlockedByOther?: boolean;
  isBlocked?: boolean;
}

export interface BlockedUserItem {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  blockedAt: string;
}

export interface PopulatedUser {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
}

export type ReactionType =
  | 'like'
  | 'love'
  | 'haha'
  | 'wow'
  | 'sad'
  | 'angry';

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  duration?: number;
}

export interface Post {
  id: string;
  user: PopulatedUser;
  author: PopulatedUser; // Legacy alias for backward compatibility
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  media?: MediaItem[];
  mediaType?: 'text' | 'image' | 'video' | 'mixed';
  videoDuration?: number;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  originalPost?: Post | null;
  isLikedByMe: boolean;
  myReaction?: ReactionType | null;
  topReactions?: ReactionType[];
  isAuthorFriend?: boolean;
  isFriend?: boolean;
  isSavedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentItem {
  id: string;
  postId: string;
  parentComment?: string | null;
  parentId?: string | null; // Legacy alias for backward compatibility
  user: PopulatedUser;
  author: PopulatedUser; // Legacy alias for backward compatibility
  content: string;
  commentType?: 'text' | 'gif';
  gifUrl?: string | null;
  likesCount?: number;
  isLikedByMe?: boolean;
  myReaction?: ReactionType | null;
  reactionsCount?: Record<string, number>;
  replies?: CommentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPosts?: number;
  totalPages: number;
}

export interface IncomingFriendRequest {
  id: string;
  requester: PopulatedUser;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface OutgoingFriendRequest {
  id: string;
  recipient: PopulatedUser;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface FriendItem {
  friendshipId: string;
  friendsSince: string;
  friend: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    bio?: string;
    location?: string;
  };
}

export type StoryMediaType = 'image' | 'video' | 'text';
export type StoryAudience = 'all' | 'close_friends' | 'hide_from';

export interface StoryItem {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  mediaType: StoryMediaType;
  mediaUrl: string;
  duration: number;
  caption: string;
  backgroundColor: string;
  audience: StoryAudience;
  viewersCount: number;
  isViewed: boolean;
  myReaction?: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface UserStoryGroup {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  stories: StoryItem[];
  hasUnseen: boolean;
  hasCloseFriends: boolean;
  latestStoryAt: string;
}

export interface StoryViewerInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  reaction?: string | null;
}

export interface StoryViewersResponse {
  count: number;
  totalViewers?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasMore?: boolean;
  reactionsSummary?: Record<string, number>;
  viewers: StoryViewerInfo[];
}

