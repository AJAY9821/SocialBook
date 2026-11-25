import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Friendship, FRIENDSHIP_STATUS } from 'models/friendship';
import { Post } from 'models/post';
import { Like } from 'models/like';
import { Comment } from 'models/comment';
import { User } from 'models/user';

export interface NotificationItem {
  id: string;
  type: 'friend_request' | 'like' | 'comment' | 'reply';
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
  isRead?: boolean;
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
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async getNotifications(userId: string): Promise<{
    unreadCount: number;
    friendRequestsCount: number;
    notifications: NotificationItem[];
  }> {
    const userObjectId = new Types.ObjectId(userId);

    // 0. Fetch user's notification read history
    const currentUser: any = await this.userModel
      .findById(userObjectId)
      .select('readNotificationIds lastReadNotificationAt')
      .lean();

    const readIdsSet = new Set<string>(currentUser?.readNotificationIds || []);
    const lastReadDate = currentUser?.lastReadNotificationAt
      ? new Date(currentUser.lastReadNotificationAt)
      : null;

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

    // 2. Fetch the user's active posts to track likes and comments (exclude deleted posts)
    const userPosts = await this.postModel
      .find({
        $or: [{ user: userObjectId }, { author: userObjectId }],
        isDeleted: false,
      })
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

      // 4. Recent top-level comments on the user's posts (exclude self-comments)
      recentComments = await this.commentModel
        .find({
          post: { $in: userPostIds },
          $or: [{ user: { $ne: userObjectId } }, { author: { $ne: userObjectId } }],
          parentComment: null,
          isDeleted: false,
        })
        .populate('user', 'name avatarUrl')
        .populate('post', 'content')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    // 5. Recent replies to the user's comments
    const userComments = await this.commentModel
      .find({
        $or: [{ user: userObjectId }, { author: userObjectId }],
        isDeleted: false,
      })
      .select('_id content post')
      .lean();

    const userCommentIds = userComments.map((c) => c._id);
    let recentReplies: any[] = [];

    if (userCommentIds.length > 0) {
      recentReplies = await this.commentModel
        .find({
          $or: [
            { parentComment: { $in: userCommentIds } },
            { parentId: { $in: userCommentIds } },
          ],
          $and: [
            {
              $or: [{ user: { $ne: userObjectId } }, { author: { $ne: userObjectId } }],
            },
          ],
          isDeleted: false,
        })
        .populate('user', 'name avatarUrl')
        .populate('post', 'content')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    // 6. Transform into a unified notification feed
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
      const postId = post?._id ? post._id.toString() : (lk.post ? lk.post.toString() : '');
      if (liker && postId) {
        items.push({
          id: lk._id.toString(),
          type: 'like',
          message: `${liker.name} liked your post.`,
          actor: {
            id: liker._id?.toString() || '',
            name: liker.name || 'Someone',
            avatarUrl: liker.avatarUrl,
          },
          post: {
            id: postId,
            content:
              post?.content?.length > 40
                ? `${post.content.slice(0, 40)}...`
                : post?.content || 'Photo post',
          },
          createdAt: lk['createdAt'] || new Date(),
        });
      }
    }

    for (const cmt of recentComments) {
      const commenter = (cmt.user || cmt.author) as any;
      const post = cmt.post as any;
      const postId = post?._id ? post._id.toString() : (cmt.post ? cmt.post.toString() : '');
      if (commenter && postId) {
        items.push({
          id: cmt._id.toString(),
          type: 'comment',
          message: `${commenter.name} commented: "${cmt.content?.length > 30 ? cmt.content.slice(0, 30) + '...' : cmt.content}"`,
          actor: {
            id: commenter._id?.toString() || '',
            name: commenter.name || 'Someone',
            avatarUrl: commenter.avatarUrl,
          },
          post: {
            id: postId,
            content:
              post?.content?.length > 40
                ? `${post.content.slice(0, 40)}...`
                : post?.content || 'Post',
          },
          createdAt: cmt['createdAt'] || new Date(),
        });
      }
    }

    for (const rep of recentReplies) {
      const replier = (rep.user || rep.author) as any;
      const post = rep.post as any;
      const postId = post?._id ? post._id.toString() : (rep.post ? rep.post.toString() : '');
      if (replier && postId) {
        const parentComment = userComments.find(
          (c) =>
            c._id.toString() ===
            (rep.parentComment?._id || rep.parentComment || rep.parentId?._id || rep.parentId)?.toString(),
        );
        const parentPreview = parentComment?.content
          ? parentComment.content.length > 20
            ? `${parentComment.content.slice(0, 20)}...`
            : parentComment.content
          : 'your comment';

        items.push({
          id: rep._id.toString(),
          type: 'reply',
          message: `${replier.name} replied to "${parentPreview}": "${rep.content?.length > 30 ? rep.content.slice(0, 30) + '...' : rep.content}"`,
          actor: {
            id: replier._id?.toString() || '',
            name: replier.name || 'Someone',
            avatarUrl: replier.avatarUrl,
          },
          post: {
            id: postId,
            content:
              post?.content?.length > 40
                ? `${post.content.slice(0, 40)}...`
                : post?.content || 'Post',
          },
          createdAt: rep['createdAt'] || new Date(),
        });
      }
    }

    // Sort all notifications by most recent first
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const formattedNotifications: NotificationItem[] = items.slice(0, 20).map((item) => {
      const isRead =
        readIdsSet.has(item.id) ||
        (lastReadDate !== null && new Date(item.createdAt) <= lastReadDate);
      return {
        ...item,
        isRead,
      };
    });

    const unreadCount = formattedNotifications.filter((i) => !i.isRead).length;
    const friendRequestsCount = pendingFriendRequests.length;

    return {
      unreadCount,
      friendRequestsCount,
      notifications: formattedNotifications,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { readNotificationIds: notificationId },
    });
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      lastReadNotificationAt: new Date(),
    });
    return { success: true };
  }
}
