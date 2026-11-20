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

    let resolvedParentId: Types.ObjectId | null = null;
    if (createCommentDto.parentId) {
      if (!Types.ObjectId.isValid(createCommentDto.parentId)) {
        throw new BadRequestException('Invalid parent comment ID.');
      }

      const parentComment = await this.commentModel.findOne({
        _id: createCommentDto.parentId,
        post: post._id,
        isDeleted: false,
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found.');
      }

      // Enforce 1-level threading: if replying to a reply, attach to the top-level parent
      resolvedParentId = (parentComment.parentId as Types.ObjectId) || (parentComment._id as Types.ObjectId);
    }

    const comment = await this.commentModel.create({
      post: post._id,
      author: new Types.ObjectId(userId),
      parentId: resolvedParentId,
      content: createCommentDto.content,
    });

    await this.postModel.findByIdAndUpdate(post._id, {
      $inc: { commentsCount: 1 },
    });

    await comment.populate('author', 'name email avatarUrl');

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: resolvedParentId ? 'Reply added successfully.' : 'Comment added successfully.',
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

    // Fetch top-level comments (parentId is null or undefined)
    const filter = {
      post: post._id,
      parentId: null,
      isDeleted: false,
    };

    const [topComments, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('author', 'name email avatarUrl')
        .exec(),
      this.commentModel.countDocuments(filter),
    ]);

    // Fetch replies for the current page of top-level comments
    const topCommentIds = topComments.map((c) => c._id);
    let replies: Comment[] = [];

    if (topCommentIds.length > 0) {
      replies = await this.commentModel
        .find({
          post: post._id,
          parentId: { $in: topCommentIds },
          isDeleted: false,
        })
        .sort({ createdAt: 1 })
        .populate('author', 'name email avatarUrl')
        .exec();
    }

    const repliesByParentId = new Map<string, any[]>();
    for (const reply of replies) {
      const pId = reply.parentId ? reply.parentId.toString() : '';
      if (!repliesByParentId.has(pId)) {
        repliesByParentId.set(pId, []);
      }
      repliesByParentId.get(pId)!.push(this.formatComment(reply));
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      comments: topComments.map((comment) =>
        this.formatComment(
          comment,
          repliesByParentId.get(comment._id.toString()) || [],
        ),
      ),
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

    let totalDeleted = 1;
    // If a top-level comment is deleted, also soft-delete all its replies
    if (!comment.parentId) {
      const childRepliesCount = await this.commentModel.countDocuments({
        parentId: comment._id,
        isDeleted: false,
      });

      if (childRepliesCount > 0) {
        await this.commentModel.updateMany(
          { parentId: comment._id, isDeleted: false },
          { isDeleted: true },
        );
        totalDeleted += childRepliesCount;
      }
    }

    await this.postModel.findOneAndUpdate(
      { _id: comment.post, commentsCount: { $gt: 0 } },
      { $inc: { commentsCount: -totalDeleted } },
    );

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Comment deleted successfully.',
    };
  }

  private formatComment(comment: any, replies: any[] = []) {
    const obj = comment.toObject ? comment.toObject() : comment;
    return {
      id: obj._id.toString(),
      postId: obj.post.toString(),
      parentId: obj.parentId ? obj.parentId.toString() : null,
      author: obj.author,
      content: obj.content,
      replies,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
