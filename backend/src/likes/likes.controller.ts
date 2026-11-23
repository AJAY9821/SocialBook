import {
  Body,
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
import { ReactPostDto } from './dto';

@ApiTags('Likes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @ApiParam({ name: 'postId', description: 'Post ID to react to' })
  @ApiResponse({ status: 200, description: 'Post reacted or updated successfully.' })
  @Post(':postId')
  async likePost(
    @Param('postId') postId: string,
    @Req() req: Request,
    @Body() reactPostDto?: ReactPostDto,
  ) {
    const userId = req['user']._id.toString();
    return this.likesService.reactToPost(
      postId,
      userId,
      reactPostDto?.reactionType,
    );
  }

  @ApiParam({ name: 'postId', description: 'Post ID to unreact' })
  @ApiResponse({ status: 200, description: 'Reaction removed successfully.' })
  @Delete(':postId')
  async unlikePost(@Param('postId') postId: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.likesService.unlikePost(postId, userId);
  }

  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'reaction', required: false, example: 'love' })
  @ApiResponse({ status: 200, description: 'List of users who reacted to the post.' })
  @Get(':postId')
  async getPostLikes(
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('reaction') reaction?: string,
  ) {
    return this.likesService.getPostLikes(
      postId,
      Number(page),
      Number(limit),
      reaction,
    );
  }
}
