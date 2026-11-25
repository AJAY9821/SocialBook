import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from 'src/middlewares';
import { CommentsService } from './comments.service';
import { CreateCommentDto, ReactCommentDto, UpdateCommentDto } from './dto';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiParam({ name: 'postId', description: 'Post ID to comment on' })
  @ApiResponse({ status: 201, description: 'Comment added successfully.' })
  @Post(':postId')
  async addComment(
    @Param('postId') postId: string,
    @Req() req: Request,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    const userId = req['user']._id.toString();
    return this.commentsService.addComment(postId, userId, createCommentDto);
  }

  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns comments for the post.' })
  @Get(':postId')
  async getPostComments(
    @Param('postId') postId: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req['user']?._id?.toString();
    return this.commentsService.getPostComments(
      postId,
      Number(page),
      Number(limit),
      userId,
    );
  }

  @ApiParam({ name: 'commentId', description: 'Comment ID to react to' })
  @ApiResponse({ status: 200, description: 'Comment reacted successfully.' })
  @Post(':commentId/react')
  async reactToComment(
    @Param('commentId') commentId: string,
    @Req() req: Request,
    @Body() reactCommentDto?: ReactCommentDto,
  ) {
    const userId = req['user']._id.toString();
    return this.commentsService.reactToComment(
      commentId,
      userId,
      reactCommentDto?.reactionType,
    );
  }

  @ApiParam({ name: 'commentId', description: 'Comment ID to remove reaction' })
  @ApiResponse({ status: 200, description: 'Comment reaction removed.' })
  @Delete(':commentId/react')
  async unlikeComment(
    @Param('commentId') commentId: string,
    @Req() req: Request,
  ) {
    const userId = req['user']._id.toString();
    return this.commentsService.unlikeComment(commentId, userId);
  }

  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'reaction', required: false, example: 'love' })
  @ApiResponse({ status: 200, description: 'List of users who reacted to the comment.' })
  @Get(':commentId/reactions')
  async getCommentReactions(
    @Param('commentId') commentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('reaction') reaction?: string,
  ) {
    return this.commentsService.getCommentReactions(
      commentId,
      Number(page),
      Number(limit),
      reaction,
    );
  }

  @ApiParam({ name: 'commentId', description: 'Comment ID to edit' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully.' })
  @Patch(':commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Req() req: Request,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    const userId = req['user']._id.toString();
    return this.commentsService.updateComment(
      commentId,
      userId,
      updateCommentDto,
    );
  }

  @ApiParam({ name: 'commentId', description: 'Comment ID to delete' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully.' })
  @Delete(':commentId')
  async deleteComment(
    @Param('commentId') commentId: string,
    @Req() req: Request,
  ) {
    const userId = req['user']._id.toString();
    return this.commentsService.deleteComment(commentId, userId);
  }
}
