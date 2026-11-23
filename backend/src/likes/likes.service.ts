import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Like, REACTION_TYPE } from 'models/like';
import { Post } from 'models/post';

@Injectable()
export class LikesService {
  constructor(
    @InjectModel(Like.name)
    private readonly likeModel: Model<Like>,
    @InjectModel(Post.name)
    private readonly postModel: Model<Post>,
  ) {}

  async reactToPost(
    postId: string,
    userId: string,
    reactionType: string = REACTION_TYPE.LIKE,
  ) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const userObjectId = new Types.ObjectId(userId);
    const existingReaction = await this.likeModel.findOne({
      user: userObjectId,
      post: post._id,
    });

    // Case 1: Tapping the exact same reaction toggles it off (unreact)
    if (existingReaction && existingReaction.reactionType === reactionType) {
      await this.likeModel.deleteOne({ _id: existingReaction._id });

      const updatedPost = await this.postModel.findOneAndUpdate(
        { _id: post._id, likesCount: { $gt: 0 } },
        { $inc: { likesCount: -1 } },
        { new: true },
      );

      return {
        error: false,
        statusCode: HttpStatus.OK,
        action: 'removed',
        msg: 'Reaction removed.',
        isLikedByMe: false,
        myReaction: null,
        likesCount: updatedPost?.likesCount ?? Math.max(0, post.likesCount - 1),
      };
    }

    // Case 2: User already has a reaction, but selected a DIFFERENT reaction (switch reaction in-place)
    if (existingReaction) {
      existingReaction.reactionType = reactionType;
      await existingReaction.save();

      return {
        error: false,
        statusCode: HttpStatus.OK,
        action: 'updated',
        msg: `Reaction changed to ${reactionType}.`,
        isLikedByMe: true,
        myReaction: reactionType,
        likesCount: post.likesCount,
      };
    }

    // Case 3: Brand new reaction
    await this.likeModel.create({
      user: userObjectId,
      post: post._id,
      reactionType,
    });

    const updatedPost = await this.postModel.findByIdAndUpdate(
      post._id,
      { $inc: { likesCount: 1 } },
      { new: true },
    );

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      action: 'created',
      msg: `Reacted with ${reactionType}.`,
      isLikedByMe: true,
      myReaction: reactionType,
      likesCount: updatedPost?.likesCount ?? post.likesCount + 1,
    };
  }

  // Backward compatibility alias for likePost
  async likePost(postId: string, userId: string) {
    return this.reactToPost(postId, userId, REACTION_TYPE.LIKE);
  }

  async unlikePost(postId: string, userId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const deletedLike = await this.likeModel.findOneAndDelete({
      user: new Types.ObjectId(userId),
      post: post._id,
    });

    if (!deletedLike) {
      throw new NotFoundException('You have not reacted to this post.');
    }

    const updatedPost = await this.postModel.findOneAndUpdate(
      { _id: post._id, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } },
      { new: true },
    );

    return {
      error: false,
      statusCode: HttpStatus.OK,
      action: 'removed',
      msg: 'Reaction removed successfully.',
      isLikedByMe: false,
      myReaction: null,
      likesCount: updatedPost?.likesCount ?? 0,
    };
  }

  async getPostLikes(
    postId: string,
    page = 1,
    limit = 20,
    reactionFilter?: string,
  ) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    // Build filter
    const baseFilter: any = { post: post._id };
    if (
      reactionFilter &&
      reactionFilter !== 'all' &&
      Object.values(REACTION_TYPE).includes(reactionFilter as any)
    ) {
      baseFilter.reactionType = reactionFilter;
    }

    // 1. Fetch breakdown of all reactions on this post using aggregation
    const breakdownAgg = await this.likeModel.aggregate([
      { $match: { post: post._id } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
    ]);

    const reactionsCount: Record<string, number> = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };

    let totalLikes = 0;
    breakdownAgg.forEach((item) => {
      const type = item._id || 'like';
      reactionsCount[type] = item.count;
      totalLikes += item.count;
    });

    // Top reactions present on this post, ordered by popularity
    const topReactions = Object.entries(reactionsCount)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);

    // 2. Fetch paginated list of users for active filter
    const [likes, totalForFilter] = await Promise.all([
      this.likeModel
        .find(baseFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('user', 'name email avatarUrl')
        .exec(),
      this.likeModel.countDocuments(baseFilter),
    ]);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      likesCount: totalLikes,
      reactionsCount,
      topReactions,
      likes: likes.map((like) => {
        const obj = like.toObject();
        return {
          id: obj._id.toString(),
          user: obj.user,
          reactionType: obj.reactionType || 'like',
          createdAt: obj.createdAt,
        };
      }),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalForFilter,
        totalPages: Math.ceil(totalForFilter / safeLimit),
      },
    };
  }
}
