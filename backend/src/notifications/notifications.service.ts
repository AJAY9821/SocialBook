import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Friendship, FRIENDSHIP_STATUS } from 'models/friendship';
import { Post } from 'models/post';
import { Like } from 'models/like';
import { Comment } from 'models/comment';

export interface NotificationItem {
  id: string;
  type: 'friend_request' | 'like' | 'comment';
  message: string;
  actor: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  post?: {
    id: string;
    content: string;
  };
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<Friendship>,
    @InjectModel(Post.name)
    private readonly postModel: Model<Post>,
    @InjectModel(Like.name)
    private readonly likeModel: Model<Like>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<Comment>,
  ) {}

  async getNotifications(userId: string): Promise<{
    unreadCount: number;
    friendRequestsCount: number;
    notifications: NotificationItem[];
  }> {
    const userObjectId = new Types.ObjectId(userId);

    // 1. Fetch pending incoming friend requests
    const pendingFriendRequests = await this.friendshipModel
      .find({
        recipient: userObjectId,
        status: FRIENDSHIP_STATUS.PENDING,
      })
      .populate('requester', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // 2. Fetch the user's posts to track likes and comments
    const userPosts = await this.postModel
      .find({ author: userObjectId })
      .select('_id content')
      .lean();

    const userPostIds = userPosts.map((p) => p._id);

    let recentLikes: any[] = [];
    let recentComments: any[] = [];

    if (userPostIds.length > 0) {
      // 3. Recent likes on the user's posts (exclude self-likes)
      recentLikes = await this.likeModel
        .find({
          post: { $in: userPostIds },
          user: { $ne: userObjectId },
        })
        .populate('user', 'name avatarUrl')
        .populate('post', 'content')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      // 4. Recent comments on the user's posts (exclude self-comments)
      recentComments = await this.commentModel
        .find({
          post: { $in: userPostIds },
          author: { $ne: userObjectId },
        })
        .populate('author', 'name avatarUrl')
        .populate('post', 'content')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    // 5. Transform into a unified notification feed
    const items: NotificationItem[] = [];

    for (const req of pendingFriendRequests) {
      const requester = req.requester as any;
      if (requester) {
        items.push({
          id: req._id.toString(),
          type: 'friend_request',
          message: `${requester.name} sent you a friend request.`,
          actor: {
            id: requester._id?.toString() || '',
            name: requester.name || 'Someone',
            avatarUrl: requester.avatarUrl,
          },
          createdAt: req['createdAt'] || new Date(),
        });
      }
    }

    for (const lk of recentLikes) {
      const liker = lk.user as any;
      const post = lk.post as any;
      if (liker) {
        items.push({
          id: lk._id.toString(),
          type: 'like',
          message: `${liker.name} liked your post.`,
          actor: {
            id: liker._id?.toString() || '',
            name: liker.name || 'Someone',
            avatarUrl: liker.avatarUrl,
          },
          post: post
            ? {
                id: post._id?.toString() || '',
                content:
                  post.content?.length > 40
                    ? `${post.content.slice(0, 40)}...`
                    : post.content || 'Photo post',
              }
            : undefined,
          createdAt: lk['createdAt'] || new Date(),
        });
      }
    }

    for (const cmt of recentComments) {
      const commenter = cmt.author as any;
      const post = cmt.post as any;
      if (commenter) {
        items.push({
          id: cmt._id.toString(),
          type: 'comment',
          message: `${commenter.name} commented: "${cmt.content?.length > 30 ? cmt.content.slice(0, 30) + '...' : cmt.content}"`,
          actor: {
            id: commenter._id?.toString() || '',
            name: commenter.name || 'Someone',
            avatarUrl: commenter.avatarUrl,
          },
          post: post
            ? {
                id: post._id?.toString() || '',
                content:
                  post.content?.length > 40
                    ? `${post.content.slice(0, 40)}...`
                    : post.content || 'Post',
              }
            : undefined,
          createdAt: cmt['createdAt'] || new Date(),
        });
      }
    }

    // Sort all notifications by most recent first
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const friendRequestsCount = pendingFriendRequests.length;
    const unreadCount = items.length;

    return {
      unreadCount,
      friendRequestsCount,
      notifications: items.slice(0, 15),
    };
  }
}
