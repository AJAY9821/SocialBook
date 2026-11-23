import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post } from 'models/post';
import { FRIENDSHIP_STATUS, Friendship } from 'models/friendship';
import { Like } from 'models/like';
import { BlocksService } from 'src/blocks/blocks.service';
import { CreatePostDto, SharePostDto, UpdatePostDto } from './dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<Post>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<Friendship>,
    @InjectModel(Like.name)
    private readonly likeModel: Model<Like>,
    private readonly blocksService: BlocksService,
  ) {}

  async createPost(
    userId: string,
    createPostDto: CreatePostDto,
    uploadedImageUrl?: string,
    uploadedVideoUrl?: string,
  ) {
    let mediaType: 'text' | 'image' | 'video' = 'text';
    if (uploadedVideoUrl) {
      mediaType = 'video';
    } else if (uploadedImageUrl) {
      mediaType = 'image';
    }

    const post = await this.postModel.create({
      user: new Types.ObjectId(userId),
      content: createPostDto.content,
      imageUrl: uploadedImageUrl || '',
      videoUrl: uploadedVideoUrl || '',
      mediaType,
      videoDuration: createPostDto.videoDuration || 0,
    });

    const populatedPost = await post.populate('user', 'name email avatarUrl');

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Post created successfully.',
      post: this.formatPost(populatedPost, null),
    };
  }

  async getFeed(userId: string, page = 1, limit = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;
    const currentObjectId = new Types.ObjectId(userId);

    // Find all accepted friends of the logged-in user
    const friendships = await this.friendshipModel
      .find({
        status: FRIENDSHIP_STATUS.ACCEPTED,
        $or: [{ requester: currentObjectId }, { recipient: currentObjectId }],
      })
      .lean();

    const blockedUserIds = await this.blocksService.getBlockedUserIds(userId);
    const blockedSet = new Set(blockedUserIds.map((id) => id.toString()));

    const authorIds: Types.ObjectId[] = [currentObjectId];
    const friendIdSet = new Set<string>();
    for (const friendship of friendships) {
      const friendId =
        friendship.requester.toString() === userId
          ? friendship.recipient.toString()
          : friendship.requester.toString();
      if (!blockedSet.has(friendId)) {
        friendIdSet.add(friendId);
        authorIds.push(new Types.ObjectId(friendId));
      }
    }

    const filter: any = {
      $or: [
        { user: { $in: authorIds } },
        { author: { $in: authorIds } },
      ],
      isDeleted: false,
    };
    if (blockedUserIds.length > 0) {
      filter.user = { $in: authorIds, $nin: blockedUserIds };
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('user', 'name email avatarUrl')
        .populate({
          path: 'originalPost',
          populate: { path: 'user', select: 'name email avatarUrl' },
        })
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const [userReactionsMap, topReactionsMap] = await Promise.all([
      this.getUserReactionsForPosts(userId, posts),
      this.getTopReactionsForPosts(posts),
    ]);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      posts: posts.map((post) => {
        const postUser = post.user || post.author;
        const postAuthorId = postUser?._id
          ? postUser._id.toString()
          : postUser?.toString() || '';
        const postIdStr = post._id.toString();
        return this.formatPost(
          post,
          userReactionsMap.get(postIdStr) || null,
          friendIdSet.has(postAuthorId),
          topReactionsMap.get(postIdStr) || [],
        );
      }),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getUserPosts(
    targetUserId: string,
    currentUserId: string,
    page = 1,
    limit = 10,
  ) {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid user ID.');
    }

    if (await this.blocksService.isBlocked(currentUserId, targetUserId)) {
      return {
        error: false,
        statusCode: HttpStatus.OK,
        posts: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const targetObjId = new Types.ObjectId(targetUserId);
    const filter = {
      $or: [{ user: targetObjId }, { author: targetObjId }],
      isDeleted: false,
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('user', 'name email avatarUrl')
        .populate({
          path: 'originalPost',
          populate: { path: 'user', select: 'name email avatarUrl' },
        })
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const [userReactionsMap, topReactionsMap] = await Promise.all([
      this.getUserReactionsForPosts(currentUserId, posts),
      this.getTopReactionsForPosts(posts),
    ]);

    const isTargetFriend =
      targetUserId !== currentUserId
        ? Boolean(
            await this.friendshipModel.exists({
              status: FRIENDSHIP_STATUS.ACCEPTED,
              $or: [
                {
                  requester: new Types.ObjectId(currentUserId),
                  recipient: new Types.ObjectId(targetUserId),
                },
                {
                  requester: new Types.ObjectId(targetUserId),
                  recipient: new Types.ObjectId(currentUserId),
                },
              ],
            }),
          )
        : false;

    return {
      error: false,
      statusCode: HttpStatus.OK,
      posts: posts.map((post) => {
        const postIdStr = post._id.toString();
        return this.formatPost(
          post,
          userReactionsMap.get(postIdStr) || null,
          isTargetFriend,
          topReactionsMap.get(postIdStr) || [],
        );
      }),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getPostById(postId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel
      .findOne({ _id: postId, isDeleted: false })
      .populate('user', 'name email avatarUrl')
      .populate({
        path: 'originalPost',
        populate: { path: 'user', select: 'name email avatarUrl' },
      })
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const postAuthor = (post.user || post.author) as any;
    const authorId = postAuthor?._id
      ? postAuthor._id.toString()
      : postAuthor?.toString();
    if (authorId && (await this.blocksService.isBlocked(currentUserId, authorId))) {
      throw new NotFoundException('Post not found.');
    }

    const [like, topReactionsAgg] = await Promise.all([
      this.likeModel.findOne({
        user: new Types.ObjectId(currentUserId),
        post: post._id,
      }),
      this.likeModel.aggregate([
        { $match: { post: post._id } },
        { $group: { _id: '$reactionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
      ]),
    ]);

    const postUser = post.user || post.author;
    const postAuthorId = postUser?._id
      ? postUser._id.toString()
      : postUser?.toString() || '';

    const isAuthorFriend =
      postAuthorId && postAuthorId !== currentUserId
        ? Boolean(
            await this.friendshipModel.exists({
              status: FRIENDSHIP_STATUS.ACCEPTED,
              $or: [
                {
                  requester: new Types.ObjectId(currentUserId),
                  recipient: new Types.ObjectId(postAuthorId),
                },
                {
                  requester: new Types.ObjectId(postAuthorId),
                  recipient: new Types.ObjectId(currentUserId),
                },
              ],
            }),
          )
        : false;

    const myReaction = like ? (like as any).reactionType || 'like' : null;
    const topReactions = topReactionsAgg.map((r) => r._id || 'like');

    return {
      error: false,
      statusCode: HttpStatus.OK,
      post: this.formatPost(post, myReaction, isAuthorFriend, topReactions),
    };
  }

  async updatePost(
    postId: string,
    userId: string,
    updatePostDto: UpdatePostDto,
    uploadedImageUrl?: string,
    uploadedVideoUrl?: string,
  ) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    if (
      updatePostDto.content === undefined &&
      !uploadedImageUrl &&
      !uploadedVideoUrl
    ) {
      throw new BadRequestException(
        'Provide content or a media file to update.',
      );
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const postOwner = (post.user || post.author)?.toString();
    if (postOwner !== userId) {
      throw new ForbiddenException('You can only update your own posts.');
    }

    if (updatePostDto.content !== undefined) {
      post.content = updatePostDto.content;
    }

    if (uploadedVideoUrl) {
      post.videoUrl = uploadedVideoUrl;
      post.imageUrl = '';
      post.mediaType = 'video';
      if (updatePostDto.videoDuration !== undefined) {
        post.videoDuration = updatePostDto.videoDuration;
      }
    } else if (uploadedImageUrl) {
      post.imageUrl = uploadedImageUrl;
      post.videoUrl = '';
      post.mediaType = 'image';
      post.videoDuration = 0;
    }

    await post.save();
    await post.populate('user', 'name email avatarUrl');

    const like = await this.likeModel.findOne({
      user: new Types.ObjectId(userId),
      post: post._id,
    });
    const myReaction = like ? (like as any).reactionType || 'like' : null;

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Post updated successfully.',
      post: this.formatPost(post, myReaction),
    };
  }

  async deletePost(postId: string, userId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const postOwner = (post.user || post.author)?.toString();
    if (postOwner !== userId) {
      throw new ForbiddenException('You can only delete your own posts.');
    }

    post.isDeleted = true;
    await post.save();

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Post deleted successfully.',
    };
  }

  async sharePost(userId: string, postId: string, sharePostDto: SharePostDto) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const targetPost = await this.postModel.findOne({
      _id: postId,
      isDeleted: false,
    });

    if (!targetPost) {
      throw new NotFoundException('Post to share not found.');
    }

    const targetPostAuthor = (targetPost.user || targetPost.author) as any;
    const authorId = targetPostAuthor?._id
      ? targetPostAuthor._id.toString()
      : targetPostAuthor?.toString();
    if (authorId && (await this.blocksService.isBlocked(userId, authorId))) {
      throw new ForbiddenException('You cannot share this post.');
    }

    // Resolve root post to prevent infinitely deep nested reposts
    const rootPostId = targetPost.originalPost || targetPost._id;

    // Atomically increment shares count on the root post
    await this.postModel.findByIdAndUpdate(rootPostId, {
      $inc: { sharesCount: 1 },
    });

    // Create the new shared post
    const sharedPost = await this.postModel.create({
      user: new Types.ObjectId(userId),
      content: sharePostDto.caption || '',
      originalPost: rootPostId,
    });

    const populatedPost = await sharedPost.populate([
      { path: 'user', select: 'name email avatarUrl' },
      {
        path: 'originalPost',
        populate: { path: 'user', select: 'name email avatarUrl' },
      },
    ]);

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Post shared successfully.',
      post: this.formatPost(populatedPost, null),
    };
  }

  async incrementShareCount(postId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel.findOne({
      _id: postId,
      isDeleted: false,
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const rootPostId = post.originalPost || post._id;

    const updated = await this.postModel.findByIdAndUpdate(
      rootPostId,
      { $inc: { sharesCount: 1 } },
      { new: true },
    );

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Share count incremented.',
      sharesCount: updated?.sharesCount ?? 1,
    };
  }

  private async getUserReactionsForPosts(
    userId: string,
    posts: Post[],
  ): Promise<Map<string, string>> {
    if (!posts.length) {
      return new Map<string, string>();
    }

    const postIds = posts.map((post) => post._id);
    const likes = await this.likeModel
      .find({
        user: new Types.ObjectId(userId),
        post: { $in: postIds },
      })
      .select('post reactionType')
      .lean();

    const map = new Map<string, string>();
    likes.forEach((like) => {
      map.set(like.post.toString(), (like as any).reactionType || 'like');
    });
    return map;
  }

  private async getTopReactionsForPosts(
    posts: Post[],
  ): Promise<Map<string, string[]>> {
    if (!posts.length) {
      return new Map<string, string[]>();
    }

    const postIds = posts.map((post) => post._id);
    const aggs = await this.likeModel.aggregate([
      { $match: { post: { $in: postIds } } },
      {
        $group: {
          _id: { post: '$post', reactionType: '$reactionType' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const map = new Map<string, string[]>();
    aggs.forEach((item) => {
      const postId = item._id.post.toString();
      const type = item._id.reactionType || 'like';
      if (!map.has(postId)) {
        map.set(postId, []);
      }
      const list = map.get(postId)!;
      if (list.length < 3) {
        list.push(type);
      }
    });
    return map;
  }

  private formatPost(
    post: Post,
    myReaction: string | boolean | null = null,
    isAuthorFriend = false,
    topReactions: string[] = [],
  ) {
    const postObj = post.toObject ? post.toObject() : (post as any);
    const resolvedReaction = typeof myReaction === 'string' ? myReaction : null;
    const user = postObj.user || postObj.author;
    const mediaType =
      postObj.mediaType ||
      (postObj.videoUrl ? 'video' : postObj.imageUrl ? 'image' : 'text');
    return {
      id: postObj._id.toString(),
      user,
      author: user, // Backward-compatible alias
      content: postObj.content || '',
      imageUrl: postObj.imageUrl || '',
      videoUrl: postObj.videoUrl || '',
      mediaType,
      videoDuration: postObj.videoDuration || 0,
      likesCount: postObj.likesCount || 0,
      commentsCount: postObj.commentsCount || 0,
      sharesCount: postObj.sharesCount || 0,
      originalPost: postObj.originalPost
        ? this.formatOriginalPost(postObj.originalPost)
        : null,
      isLikedByMe: Boolean(myReaction),
      myReaction: resolvedReaction,
      topReactions:
        topReactions.length > 0
          ? topReactions
          : postObj.likesCount > 0
            ? ['like']
            : [],
      isAuthorFriend,
      createdAt: postObj.createdAt,
      updatedAt: postObj.updatedAt,
    };
  }

  private formatOriginalPost(orig: any) {
    if (!orig || !orig._id) return null;
    const user = orig.user || orig.author;
    const mediaType =
      orig.mediaType ||
      (orig.videoUrl ? 'video' : orig.imageUrl ? 'image' : 'text');
    return {
      id: orig._id.toString(),
      user,
      author: user, // Backward-compatible alias
      content: orig.content || '',
      imageUrl: orig.imageUrl || '',
      videoUrl: orig.videoUrl || '',
      mediaType,
      videoDuration: orig.videoDuration || 0,
      likesCount: orig.likesCount || 0,
      commentsCount: orig.commentsCount || 0,
      sharesCount: orig.sharesCount || 0,
      createdAt: orig.createdAt,
      updatedAt: orig.updatedAt,
    };
  }
}
