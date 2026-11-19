import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Like } from 'models/like';
import { Post } from 'models/post';

@Injectable()
export class LikesService {
  constructor(
    @InjectModel(Like.name)
    private readonly likeModel: Model<Like>,
    @InjectModel(Post.name)
    private readonly postModel: Model<Post>,
  ) {}

  async likePost(postId: string, userId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    try {
      await this.likeModel.create({
        user: new Types.ObjectId(userId),
        post: post._id,
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new ConflictException('You have already liked this post.');
      }
      throw error;
    }

    const updatedPost = await this.postModel.findByIdAndUpdate(
      post._id,
      { $inc: { likesCount: 1 } },
      { new: true },
    );

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Post liked successfully.',
      likesCount: updatedPost?.likesCount ?? post.likesCount + 1,
    };
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
      throw new NotFoundException('You have not liked this post.');
    }

    const updatedPost = await this.postModel.findOneAndUpdate(
      { _id: post._id, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } },
      { new: true },
    );

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Post unliked successfully.',
      likesCount: updatedPost?.likesCount ?? 0,
    };
  }

  async getPostLikes(postId: string, page = 1, limit = 20) {
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

    const filter = { post: post._id };

    const [likes, total] = await Promise.all([
      this.likeModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('user', 'name email avatarUrl')
        .exec(),
      this.likeModel.countDocuments(filter),
    ]);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      likesCount: total,
      likes: likes.map((like) => {
        const obj = like.toObject();
        return {
          id: obj._id.toString(),
          user: obj.user,
          createdAt: obj.createdAt,
        };
      }),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
}
