import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment } from 'models/comment';
import { Post } from 'models/post';
import { CreateCommentDto, UpdateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<Comment>,
    @InjectModel(Post.name)
    private readonly postModel: Model<Post>,
  ) {}

  async addComment(
    postId: string,
    userId: string,
    createCommentDto: CreateCommentDto,
  ) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID.');
    }

    const post = await this.postModel.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const comment = await this.commentModel.create({
      post: post._id,
      author: new Types.ObjectId(userId),
      content: createCommentDto.content,
    });

    await this.postModel.findByIdAndUpdate(post._id, {
      $inc: { commentsCount: 1 },
    });

    await comment.populate('author', 'name email avatarUrl');

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Comment added successfully.',
      comment: this.formatComment(comment),
    };
  }

  async getPostComments(postId: string, page = 1, limit = 20) {
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

    const filter = { post: post._id, isDeleted: false };

    const [comments, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('author', 'name email avatarUrl')
        .exec(),
      this.commentModel.countDocuments(filter),
    ]);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      comments: comments.map((comment) => this.formatComment(comment)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async updateComment(
    commentId: string,
    userId: string,
    updateCommentDto: UpdateCommentDto,
  ) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Invalid comment ID.');
    }

    const comment = await this.commentModel.findOne({
      _id: commentId,
      isDeleted: false,
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    if (comment.author.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own comments.');
    }

    comment.content = updateCommentDto.content;
    await comment.save();
    await comment.populate('author', 'name email avatarUrl');

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Comment updated successfully.',
      comment: this.formatComment(comment),
    };
  }

  async deleteComment(commentId: string, userId: string) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Invalid comment ID.');
    }

    const comment = await this.commentModel.findOne({
      _id: commentId,
      isDeleted: false,
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const post = await this.postModel.findById(comment.post);
    const isCommentAuthor = comment.author.toString() === userId;
    const isPostAuthor = post && post.author.toString() === userId;

    if (!isCommentAuthor && !isPostAuthor) {
      throw new ForbiddenException(
        'Only the comment author or post owner can delete this comment.',
      );
    }

    comment.isDeleted = true;
    await comment.save();

    await this.postModel.findOneAndUpdate(
      { _id: comment.post, commentsCount: { $gt: 0 } },
      { $inc: { commentsCount: -1 } },
    );

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Comment deleted successfully.',
    };
  }

  private formatComment(comment: Comment) {
    const obj = comment.toObject();
    return {
      id: obj._id.toString(),
      postId: obj.post.toString(),
      author: obj.author,
      content: obj.content,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
