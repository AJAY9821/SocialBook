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
}

export interface PopulatedUser {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
}

export interface Post {
  id: string;
  author: PopulatedUser;
  content: string;
  imageUrl?: string;
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentItem {
  id: string;
  postId: string;
  author: PopulatedUser;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
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
