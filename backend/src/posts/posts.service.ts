import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Post } from 'models/post';
import { FRIENDSHIP_STATUS, Friendship } from 'models/friendship';
import { Like } from 'models/like';
import { SavedPost } from 'models/saved-post';
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
    @InjectModel(SavedPost.name)
    private readonly savedPostModel: Model<SavedPost>,
    private readonly blocksService: BlocksService,
  ) {}

  async createPost(
    userId: string,
    createPostDto: CreatePostDto,
    uploadedImageUrl?: string,
    uploadedVideoUrl?: string,
    mediaItems: Array<{ type: 'image' | 'video'; url: string; duration?: number }> = [],
  ) {
    let finalMedia = [...mediaItems];
    if (finalMedia.length === 0) {
      if (uploadedImageUrl) finalMedia.push({ type: 'image', url: uploadedImageUrl });
      if (uploadedVideoUrl) {
        finalMedia.push({
          type: 'video',
          url: uploadedVideoUrl,
          duration: createPostDto.videoDuration ? Number(createPostDto.videoDuration) : 0,
        });
      }
    }

    const hasImages = finalMedia.some((m) => m.type === 'image');
    const hasVideos = finalMedia.some((m) => m.type === 'video');

    let mediaType: 'text' | 'image' | 'video' | 'mixed' = 'text';
    if (hasImages && hasVideos) {
      mediaType = 'mixed';
    } else if (hasVideos) {
      mediaType = 'video';
    } else if (hasImages) {
      mediaType = 'image';
    }

    const firstImage = finalMedia.find((m) => m.type === 'image')?.url || uploadedImageUrl || '';
    const firstVideo = finalMedia.find((m) => m.type === 'video')?.url || uploadedVideoUrl || '';

    const post = await this.postModel.create({
      user: new Types.ObjectId(userId),
      content: createPostDto.content,
      imageUrl: firstImage,
      videoUrl: firstVideo,
      media: finalMedia,
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

    const [userReactionsMap, topReactionsMap, savedPostIdsSet] = await Promise.all([
      this.getUserReactionsForPosts(userId, posts),
      this.getTopReactionsForPosts(posts),
      this.getUserSavedPostIds(userId, posts),
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
          savedPostIdsSet.has(postIdStr),
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

    const [userReactionsMap, topReactionsMap, savedPostIdsSet] = await Promise.all([
      this.getUserReactionsForPosts(currentUserId, posts),
      this.getTopReactionsForPosts(posts),
      this.getUserSavedPostIds(currentUserId, posts),
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
          savedPostIdsSet.has(postIdStr),
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

    const [like, topReactionsAgg, isSaved] = await Promise.all([
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
      this.savedPostModel.exists({
        user: new Types.ObjectId(currentUserId),
        post: post._id,
      }),
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
      post: this.formatPost(
        post,
        myReaction,
        isAuthorFriend,
        topReactions,
        Boolean(isSaved),
      ),
    };
  }

  async updatePost(
    postId: string,
    userId: string,
    updatePostDto: UpdatePostDto,
    uploadedImageUrl?: string,
    uploadedVideoUrl?: string,
    mediaItems: Array<{ type: 'image' | 'video'; url: string; duration?: number }> = [],
  ) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    if (
      updatePostDto.content === undefined &&
      !uploadedImageUrl &&
      !uploadedVideoUrl &&
      mediaItems.length === 0
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

    if (mediaItems.length > 0) {
      post.media = mediaItems;
      const firstImg = mediaItems.find((m) => m.type === 'image');
      const firstVid = mediaItems.find((m) => m.type === 'video');
      post.imageUrl = firstImg?.url || '';
      post.videoUrl = firstVid?.url || '';
      if (firstImg && firstVid) {
        post.mediaType = 'mixed';
      } else if (firstVid) {
        post.mediaType = 'video';
      } else if (firstImg) {
        post.mediaType = 'image';
      }
    } else if (uploadedVideoUrl && uploadedImageUrl) {
      post.videoUrl = uploadedVideoUrl;
      post.imageUrl = uploadedImageUrl;
      post.media = [
        { type: 'image', url: uploadedImageUrl },
        {
          type: 'video',
          url: uploadedVideoUrl,
          duration: updatePostDto.videoDuration ? Number(updatePostDto.videoDuration) : 0,
        },
      ];
      post.mediaType = 'mixed';
    } else if (uploadedVideoUrl) {
      post.videoUrl = uploadedVideoUrl;
      post.media = [
        {
          type: 'video',
          url: uploadedVideoUrl,
          duration: updatePostDto.videoDuration ? Number(updatePostDto.videoDuration) : 0,
        },
      ];
      post.mediaType = 'video';
    } else if (uploadedImageUrl) {
      post.imageUrl = uploadedImageUrl;
      post.media = [{ type: 'image', url: uploadedImageUrl }];
      post.mediaType = 'image';
    }

    if (updatePostDto.videoDuration !== undefined) {
      post.videoDuration = updatePostDto.videoDuration;
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

    // Cascade: clean up saved bookmarks pointing to this deleted post
    try {
      await this.savedPostModel.deleteMany({ post: post._id });
    } catch {
      // Non-blocking cascade cleanup
    }

    // Clean up local media files from disk to prevent storage leaks
    const mediaUrls = [post.imageUrl, post.videoUrl].filter(Boolean) as string[];
    for (const url of mediaUrls) {
      if (url.includes('/uploads/posts/')) {
        try {
          const subPath = url.split('/uploads/posts/')[1];
          if (subPath) {
            const filePath = path.join(process.cwd(), 'uploads', 'posts', subPath);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        } catch {
          // Non-blocking file unlink
        }
      }
    }

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
    isSavedByMe = false,
  ) {
    const postObj = post.toObject ? post.toObject() : (post as any);
    const resolvedReaction = typeof myReaction === 'string' ? myReaction : null;
    const user = postObj.user || postObj.author;

    let resolvedMedia: Array<{ type: 'image' | 'video'; url: string; duration?: number }> = [];
    if (Array.isArray(postObj.media) && postObj.media.length > 0) {
      resolvedMedia = postObj.media.map((item: any) => ({
        type: item.type === 'video' ? 'video' : 'image',
        url: item.url,
        duration: item.duration || 0,
      }));
    } else {
      if (postObj.imageUrl) {
        resolvedMedia.push({ type: 'image', url: postObj.imageUrl });
      }
      if (postObj.videoUrl) {
        resolvedMedia.push({
          type: 'video',
          url: postObj.videoUrl,
          duration: postObj.videoDuration || 0,
        });
      }
    }

    const hasImages = resolvedMedia.some((m) => m.type === 'image') || Boolean(postObj.imageUrl);
    const hasVideos = resolvedMedia.some((m) => m.type === 'video') || Boolean(postObj.videoUrl);

    const mediaType =
      postObj.mediaType ||
      (hasImages && hasVideos
        ? 'mixed'
        : hasVideos
          ? 'video'
          : hasImages
            ? 'image'
            : 'text');
    return {
      id: postObj._id.toString(),
      user,
      author: user, // Backward-compatible alias
      content: postObj.content || '',
      imageUrl: postObj.imageUrl || '',
      videoUrl: postObj.videoUrl || '',
      media: resolvedMedia,
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
      isSavedByMe: Boolean(isSavedByMe),
      createdAt: postObj.createdAt,
      updatedAt: postObj.updatedAt,
    };
  }

  private formatOriginalPost(orig: any) {
    if (!orig || !orig._id) return null;
    const user = orig.user || orig.author;

    let origMedia: Array<{ type: 'image' | 'video'; url: string; duration?: number }> = [];
    if (Array.isArray(orig.media) && orig.media.length > 0) {
      origMedia = orig.media.map((item: any) => ({
        type: item.type === 'video' ? 'video' : 'image',
        url: item.url,
        duration: item.duration || 0,
      }));
    } else {
      if (orig.imageUrl) {
        origMedia.push({ type: 'image', url: orig.imageUrl });
      }
      if (orig.videoUrl) {
        origMedia.push({
          type: 'video',
          url: orig.videoUrl,
          duration: orig.videoDuration || 0,
        });
      }
    }

    const hasImages = origMedia.some((m) => m.type === 'image') || Boolean(orig.imageUrl);
    const hasVideos = origMedia.some((m) => m.type === 'video') || Boolean(orig.videoUrl);

    const mediaType =
      orig.mediaType ||
      (hasImages && hasVideos
        ? 'mixed'
        : hasVideos
          ? 'video'
          : hasImages
            ? 'image'
            : 'text');
    return {
      id: orig._id.toString(),
      user,
      author: user, // Backward-compatible alias
      content: orig.content || '',
      imageUrl: orig.imageUrl || '',
      videoUrl: orig.videoUrl || '',
      media: origMedia,
      mediaType,
      videoDuration: orig.videoDuration || 0,
      likesCount: orig.likesCount || 0,
      commentsCount: orig.commentsCount || 0,
      sharesCount: orig.sharesCount || 0,
      createdAt: orig.createdAt,
      updatedAt: orig.updatedAt,
    };
  }

  private async getUserSavedPostIds(
    userId: string,
    posts: Post[],
  ): Promise<Set<string>> {
    if (!posts.length) {
      return new Set<string>();
    }

    const postIds = posts.map((post) => post._id);
    const saved = await this.savedPostModel
      .find({
        user: new Types.ObjectId(userId),
        post: { $in: postIds },
      })
      .select('post')
      .lean();

    return new Set(saved.map((s) => s.post.toString()));
  }

  async toggleSavePost(userId: string, postId: string) {
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

    const userObjId = new Types.ObjectId(userId);
    const postObjId = new Types.ObjectId(postId);

    const existing = await this.savedPostModel.findOne({
      user: userObjId,
      post: postObjId,
    });

    if (existing) {
      await this.savedPostModel.deleteOne({ _id: existing._id });
      return {
        error: false,
        statusCode: HttpStatus.OK,
        msg: 'Post removed from saved posts.',
        isSaved: false,
      };
    } else {
      await this.savedPostModel.create({
        user: userObjId,
        post: postObjId,
      });
      return {
        error: false,
        statusCode: HttpStatus.CREATED,
        msg: 'Post saved to bookmarks.',
        isSaved: true,
      };
    }
  }

  async getSavedPosts(userId: string, page = 1, limit = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const userObjId = new Types.ObjectId(userId);

    const [savedDocs, total] = await Promise.all([
      this.savedPostModel
        .find({ user: userObjId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate({
          path: 'post',
          match: { isDeleted: false },
          populate: [
            { path: 'user', select: 'name email avatarUrl' },
            {
              path: 'originalPost',
              populate: { path: 'user', select: 'name email avatarUrl' },
            },
          ],
        })
        .exec(),
      this.savedPostModel.countDocuments({ user: userObjId }),
    ]);

    const validPosts: Post[] = savedDocs
      .map((doc) => doc.post as any)
      .filter((p) => p && !p.isDeleted);

    const [userReactionsMap, topReactionsMap] = await Promise.all([
      this.getUserReactionsForPosts(userId, validPosts),
      this.getTopReactionsForPosts(validPosts),
    ]);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      posts: validPosts.map((post) => {
        const postIdStr = post._id.toString();
        return this.formatPost(
          post,
          userReactionsMap.get(postIdStr) || null,
          false,
          topReactionsMap.get(postIdStr) || [],
          true,
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

  async getSaveStatus(userId: string, postId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }
    const isSaved = await this.savedPostModel.exists({
      user: new Types.ObjectId(userId),
      post: new Types.ObjectId(postId),
    });
    return {
      error: false,
      statusCode: HttpStatus.OK,
      isSaved: Boolean(isSaved),
    };
  }
}
