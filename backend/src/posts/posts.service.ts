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
  ) {}

  async createPost(
    userId: string,
    createPostDto: CreatePostDto,
    uploadedImageUrl?: string,
  ) {
    const post = await this.postModel.create({
      author: new Types.ObjectId(userId),
      content: createPostDto.content,
      imageUrl: uploadedImageUrl || '',
    });

    const populatedPost = await post.populate('author', 'name email avatarUrl');

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Post created successfully.',
      post: this.formatPost(populatedPost, false),
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

    const authorIds: Types.ObjectId[] = [currentObjectId];
    for (const friendship of friendships) {
      const friendId =
        friendship.requester.toString() === userId
          ? friendship.recipient
          : friendship.requester;
      authorIds.push(new Types.ObjectId(friendId.toString()));
    }

    const filter = {
      author: { $in: authorIds },
      isDeleted: false,
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('author', 'name email avatarUrl')
        .populate({
          path: 'originalPost',
          populate: { path: 'author', select: 'name email avatarUrl' },
        })
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const likedPostIds = await this.getLikedPostIdSet(userId, posts);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      posts: posts.map((post) =>
        this.formatPost(post, likedPostIds.has(post._id.toString())),
      ),
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

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const filter = {
      author: new Types.ObjectId(targetUserId),
      isDeleted: false,
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('author', 'name email avatarUrl')
        .populate({
          path: 'originalPost',
          populate: { path: 'author', select: 'name email avatarUrl' },
        })
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const likedPostIds = await this.getLikedPostIdSet(currentUserId, posts);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      posts: posts.map((post) =>
        this.formatPost(post, likedPostIds.has(post._id.toString())),
      ),
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
      .populate('author', 'name email avatarUrl')
      .populate({
        path: 'originalPost',
        populate: { path: 'author', select: 'name email avatarUrl' },
      })
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const like = await this.likeModel.findOne({
      user: new Types.ObjectId(currentUserId),
      post: post._id,
    });

    return {
      error: false,
      statusCode: HttpStatus.OK,
      post: this.formatPost(post, Boolean(like)),
    };
  }

  async updatePost(
    postId: string,
    userId: string,
    updatePostDto: UpdatePostDto,
    uploadedImageUrl?: string,
  ) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    if (updatePostDto.content === undefined && !uploadedImageUrl) {
      throw new BadRequestException(
        'Provide content or an image file to update.',
      );
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    if (post.author.toString() !== userId) {
      throw new ForbiddenException('You can only update your own posts.');
    }

    if (updatePostDto.content !== undefined) {
      post.content = updatePostDto.content;
    }

    if (uploadedImageUrl) {
      post.imageUrl = uploadedImageUrl;
    }

    await post.save();
    await post.populate('author', 'name email avatarUrl');

    const like = await this.likeModel.findOne({
      user: new Types.ObjectId(userId),
      post: post._id,
    });

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Post updated successfully.',
      post: this.formatPost(post, Boolean(like)),
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

    if (post.author.toString() !== userId) {
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

    // Resolve root post to prevent infinitely deep nested reposts
    const rootPostId = targetPost.originalPost || targetPost._id;

    // Atomically increment shares count on the root post
    await this.postModel.findByIdAndUpdate(rootPostId, {
      $inc: { sharesCount: 1 },
    });

    // Create the new shared post
    const sharedPost = await this.postModel.create({
      author: new Types.ObjectId(userId),
      content: sharePostDto.caption || '',
      originalPost: rootPostId,
    });

    const populatedPost = await sharedPost.populate([
      { path: 'author', select: 'name email avatarUrl' },
      {
        path: 'originalPost',
        populate: { path: 'author', select: 'name email avatarUrl' },
      },
    ]);

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Post shared successfully.',
      post: this.formatPost(populatedPost, false),
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

  private async getLikedPostIdSet(
    userId: string,
    posts: Post[],
  ): Promise<Set<string>> {
    if (!posts.length) {
      return new Set<string>();
    }

    const postIds = posts.map((post) => post._id);
    const likes = await this.likeModel
      .find({
        user: new Types.ObjectId(userId),
        post: { $in: postIds },
      })
      .select('post')
      .lean();

    return new Set(likes.map((like) => like.post.toString()));
  }

  private formatPost(post: Post, isLikedByMe: boolean) {
    const postObj = post.toObject ? post.toObject() : (post as any);
    return {
      id: postObj._id.toString(),
      author: postObj.author,
      content: postObj.content || '',
      imageUrl: postObj.imageUrl || '',
      likesCount: postObj.likesCount || 0,
      commentsCount: postObj.commentsCount || 0,
      sharesCount: postObj.sharesCount || 0,
      originalPost: postObj.originalPost
        ? this.formatOriginalPost(postObj.originalPost)
        : null,
      isLikedByMe,
      createdAt: postObj.createdAt,
      updatedAt: postObj.updatedAt,
    };
  }

  private formatOriginalPost(orig: any) {
    if (!orig || !orig._id) return null;
    return {
      id: orig._id.toString(),
      author: orig.author,
      content: orig.content || '',
      imageUrl: orig.imageUrl || '',
      likesCount: orig.likesCount || 0,
      commentsCount: orig.commentsCount || 0,
      sharesCount: orig.sharesCount || 0,
      createdAt: orig.createdAt,
      updatedAt: orig.updatedAt,
    };
  }
}
