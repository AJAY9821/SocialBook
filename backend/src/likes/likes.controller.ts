import {
  Controller,
  Delete,
  Get,
  Param,
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
import { LikesService } from './likes.service';

@ApiTags('Likes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @ApiParam({ name: 'postId', description: 'Post ID to like' })
  @ApiResponse({ status: 201, description: 'Post liked successfully.' })
  @Post(':postId')
  async likePost(@Param('postId') postId: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.likesService.likePost(postId, userId);
  }

  @ApiParam({ name: 'postId', description: 'Post ID to unlike' })
  @ApiResponse({ status: 200, description: 'Post unliked successfully.' })
  @Delete(':postId')
  async unlikePost(@Param('postId') postId: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.likesService.unlikePost(postId, userId);
  }

  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'List of users who liked the post.' })
  @Get(':postId')
  async getPostLikes(
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.likesService.getPostLikes(postId, Number(page), Number(limit));
  }
}
