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
import { CommentLike, REACTION_TYPE } from 'models/comment-like';
import { Post } from 'models/post';
import { CreateCommentDto, UpdateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<Comment>,
    @InjectModel(CommentLike.name)
    private readonly commentLikeModel: Model<CommentLike>,
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

    const requestedParent = createCommentDto.parentComment || createCommentDto.parentId;
    let resolvedParentId: Types.ObjectId | null = null;
    if (requestedParent) {
      if (!Types.ObjectId.isValid(requestedParent)) {
        throw new BadRequestException('Invalid parent comment ID.');
      }

      const parentComment = await this.commentModel.findOne({
        _id: requestedParent,
        post: post._id,
        isDeleted: false,
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found.');
      }

      // Enforce 1-level threading: if replying to a reply, attach to the top-level parent
      resolvedParentId =
        ((parentComment.parentComment || parentComment.parentId) as Types.ObjectId) ||
        (parentComment._id as Types.ObjectId);
    }

    const rawContent = createCommentDto.content?.trim() || '';
    const gifUrl = createCommentDto.gifUrl?.trim() || null;

    if (!rawContent && !gifUrl) {
      throw new BadRequestException('Comment must contain text or a GIF.');
    }

    const commentType = gifUrl ? 'gif' : 'text';

    const comment = await this.commentModel.create({
      post: post._id,
      user: new Types.ObjectId(userId),
      parentComment: resolvedParentId,
      content: rawContent,
      commentType,
      gifUrl,
    });

    await this.postModel.findByIdAndUpdate(post._id, {
      $inc: { commentsCount: 1 },
    });

    await comment.populate('user', 'name email avatarUrl');

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: resolvedParentId ? 'Reply added successfully.' : 'Comment added successfully.',
      comment: this.formatComment(comment),
    };
  }

  async getPostComments(postId: string, page = 1, limit = 20, currentUserId?: string) {
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

    // Fetch top-level comments (parentComment is null or undefined)
    const filter = {
      post: post._id,
      parentComment: null,
      isDeleted: false,
    };

    const [topComments, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('user', 'name email avatarUrl')
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
          $or: [
            { parentComment: { $in: topCommentIds } },
            { parentId: { $in: topCommentIds } },
          ],
          isDeleted: false,
        })
        .sort({ createdAt: 1 })
        .populate('user', 'name email avatarUrl')
        .exec();
    }

    const allCommentIds = [...topCommentIds, ...replies.map((r) => r._id)];
    const userReactionMap = new Map<string, string>();
    const commentReactionsMap = new Map<string, Record<string, number>>();

    if (allCommentIds.length > 0) {
      const [userReactions, aggCounts] = await Promise.all([
        currentUserId && Types.ObjectId.isValid(currentUserId)
          ? this.commentLikeModel
              .find({
                user: new Types.ObjectId(currentUserId),
                comment: { $in: allCommentIds },
              })
              .lean()
              .exec()
          : Promise.resolve([]),
        this.commentLikeModel.aggregate([
          { $match: { comment: { $in: allCommentIds } } },
          {
            $group: {
              _id: { comment: '$comment', type: '$reactionType' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      (userReactions as any[]).forEach((ur) => {
        userReactionMap.set(ur.comment.toString(), ur.reactionType);
      });

      aggCounts.forEach((ac: any) => {
        const cId = ac._id.comment.toString();
        if (!commentReactionsMap.has(cId)) {
          commentReactionsMap.set(cId, {});
        }
        commentReactionsMap.get(cId)![ac._id.type] = ac.count;
      });
    }

    const repliesByParentId = new Map<string, any[]>();
    for (const reply of replies) {
      const parentRef = reply.parentComment || reply.parentId;
      const pId = parentRef ? parentRef.toString() : '';
      if (!repliesByParentId.has(pId)) {
        repliesByParentId.set(pId, []);
      }
      repliesByParentId
        .get(pId)!
        .push(
          this.formatComment(
            reply,
            [],
            userReactionMap,
            commentReactionsMap,
          ),
        );
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      comments: topComments.map((comment) =>
        this.formatComment(
          comment,
          repliesByParentId.get(comment._id.toString()) || [],
          userReactionMap,
          commentReactionsMap,
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

    const commentUser = (comment.user || comment.author)?.toString();
    if (commentUser !== userId) {
      throw new ForbiddenException('You can only edit your own comments.');
    }

    const newContent =
      updateCommentDto.content !== undefined
        ? updateCommentDto.content?.trim() || ''
        : comment.content;
    const newGifUrl =
      updateCommentDto.gifUrl !== undefined
        ? updateCommentDto.gifUrl?.trim() || null
        : comment.gifUrl;

    if (!newContent && !newGifUrl) {
      throw new BadRequestException('Comment must contain text or a GIF.');
    }

    comment.content = newContent;
    comment.gifUrl = newGifUrl;
    comment.commentType = newGifUrl ? 'gif' : 'text';
    await comment.save();
    await comment.populate('user', 'name email avatarUrl');

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
    const isCommentAuthor = (comment.user || comment.author)?.toString() === userId;
    const isPostAuthor = post && (post.user || post.author)?.toString() === userId;

    if (!isCommentAuthor && !isPostAuthor) {
      throw new ForbiddenException(
        'Only the comment author or post owner can delete this comment.',
      );
    }

    comment.isDeleted = true;
    await comment.save();

    const deletedCommentIds: Types.ObjectId[] = [comment._id as Types.ObjectId];
    let totalDeleted = 1;
    // If a top-level comment is deleted, also soft-delete all its replies
    const parentRef = comment.parentComment || comment.parentId;
    if (!parentRef) {
      const childReplies = await this.commentModel
        .find({
          $or: [{ parentComment: comment._id }, { parentId: comment._id }],
          isDeleted: false,
        })
        .select('_id');

      if (childReplies.length > 0) {
        const childIds = childReplies.map((r) => r._id as Types.ObjectId);
        deletedCommentIds.push(...childIds);
        await this.commentModel.updateMany(
          { _id: { $in: childIds } },
          { isDeleted: true },
        );
        totalDeleted += childReplies.length;
      }
    }

    // Clean up reactions for deleted comments
    await this.commentLikeModel.deleteMany({ comment: { $in: deletedCommentIds } });

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

  async reactToComment(
    commentId: string,
    userId: string,
    reactionType: string = REACTION_TYPE.LIKE,
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

    const userObjectId = new Types.ObjectId(userId);
    const existingReaction = await this.commentLikeModel.findOne({
      user: userObjectId,
      comment: comment._id,
    });

    // Case 1: Tapping exact same reaction toggles it off
    if (existingReaction && existingReaction.reactionType === reactionType) {
      await this.commentLikeModel.deleteOne({ _id: existingReaction._id });
      const updated = await this.commentModel.findOneAndUpdate(
        { _id: comment._id, likesCount: { $gt: 0 } },
        { $inc: { likesCount: -1 } },
        { new: true },
      );
      const reactionsCount = await this.getCommentReactionsCount(comment._id as Types.ObjectId);
      return {
        error: false,
        statusCode: HttpStatus.OK,
        action: 'removed',
        msg: 'Reaction removed.',
        isLikedByMe: false,
        myReaction: null,
        likesCount: updated?.likesCount ?? Math.max(0, (comment.likesCount || 0) - 1),
        reactionsCount,
      };
    }

    // Case 2: Changing reaction in-place
    if (existingReaction) {
      existingReaction.reactionType = reactionType;
      await existingReaction.save();
      const reactionsCount = await this.getCommentReactionsCount(comment._id as Types.ObjectId);
      return {
        error: false,
        statusCode: HttpStatus.OK,
        action: 'updated',
        msg: `Reaction changed to ${reactionType}.`,
        isLikedByMe: true,
        myReaction: reactionType,
        likesCount: comment.likesCount || 1,
        reactionsCount,
      };
    }

    // Case 3: New reaction
    await this.commentLikeModel.create({
      user: userObjectId,
      comment: comment._id,
      reactionType,
    });
    const updated = await this.commentModel.findByIdAndUpdate(
      comment._id,
      { $inc: { likesCount: 1 } },
      { new: true },
    );
    const reactionsCount = await this.getCommentReactionsCount(comment._id as Types.ObjectId);
    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      action: 'added',
      msg: `Reacted with ${reactionType}.`,
      isLikedByMe: true,
      myReaction: reactionType,
      likesCount: updated?.likesCount ?? ((comment.likesCount || 0) + 1),
      reactionsCount,
    };
  }

  async unlikeComment(commentId: string, userId: string) {
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

    const userObjectId = new Types.ObjectId(userId);
    const existing = await this.commentLikeModel.findOne({
      user: userObjectId,
      comment: comment._id,
    });

    if (existing) {
      await this.commentLikeModel.deleteOne({ _id: existing._id });
      await this.commentModel.findOneAndUpdate(
        { _id: comment._id, likesCount: { $gt: 0 } },
        { $inc: { likesCount: -1 } },
      );
    }

    const reactionsCount = await this.getCommentReactionsCount(comment._id as Types.ObjectId);
    return {
      error: false,
      statusCode: HttpStatus.OK,
      action: 'removed',
      msg: 'Reaction removed.',
      isLikedByMe: false,
      myReaction: null,
      likesCount: Math.max(0, (comment.likesCount || 0) - (existing ? 1 : 0)),
      reactionsCount,
    };
  }

  async getCommentReactions(
    commentId: string,
    page = 1,
    limit = 20,
    reactionType?: string,
  ) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Invalid comment ID.');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const query: any = { comment: new Types.ObjectId(commentId) };
    if (reactionType && reactionType !== 'all') {
      query.reactionType = reactionType;
    }

    const [reactions, total, breakdown] = await Promise.all([
      this.commentLikeModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('user', 'name email avatarUrl')
        .lean()
        .exec(),
      this.commentLikeModel.countDocuments(query),
      this.getCommentReactionsCount(new Types.ObjectId(commentId)),
    ]);

    const totalLikes = Object.values(breakdown).reduce((sum, n) => sum + n, 0);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      likesCount: totalLikes,
      reactionsCount: breakdown,
      likes: reactions.map((r: any) => ({
        id: r._id.toString(),
        user: r.user,
        reactionType: r.reactionType,
        createdAt: r.createdAt,
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private async getCommentReactionsCount(
    commentId: Types.ObjectId,
  ): Promise<Record<string, number>> {
    const counts = await this.commentLikeModel.aggregate([
      { $match: { comment: commentId } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
    ]);
    const result: Record<string, number> = {};
    counts.forEach((c) => {
      result[c._id] = c.count;
    });
    return result;
  }

  private formatComment(
    comment: any,
    replies: any[] = [],
    userReactionMap?: Map<string, string>,
    commentReactionsMap?: Map<string, Record<string, number>>,
  ) {
    const obj = comment.toObject ? comment.toObject() : comment;
    const user = obj.user || obj.author;
    const parent = obj.parentComment || obj.parentId;
    const commentIdStr = obj._id.toString();
    const myReaction = userReactionMap?.get(commentIdStr) || null;
    const reactionsCount = commentReactionsMap?.get(commentIdStr) || {};
    const totalReactions = Object.values(reactionsCount).reduce(
      (sum, n) => sum + n,
      0,
    );
    const likesCount =
      obj.likesCount !== undefined && obj.likesCount > 0
        ? obj.likesCount
        : totalReactions;

    return {
      id: commentIdStr,
      postId: obj.post ? obj.post.toString() : '',
      parentComment: parent ? parent.toString() : null,
      parentId: parent ? parent.toString() : null, // Backward compatible
      user,
      author: user, // Backward compatible
      content: obj.content || '',
      commentType: obj.commentType || (obj.gifUrl ? 'gif' : 'text'),
      gifUrl: obj.gifUrl || null,
      likesCount,
      isLikedByMe: !!myReaction,
      myReaction,
      reactionsCount,
      replies,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
