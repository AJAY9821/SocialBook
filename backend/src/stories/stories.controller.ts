import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { AuthGuard } from 'src/middlewares';
import { StoriesService } from './stories.service';
import { CreateStoryDto, ReactStoryDto, ReplyStoryDto, UpdateCloseFriendsDto } from './dto';

const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

const storyMediaMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const storiesUploadDir = path.join(process.cwd(), 'uploads', 'stories');
      if (!fs.existsSync(storiesUploadDir)) {
        fs.mkdirSync(storiesUploadDir, { recursive: true });
      }
      cb(null, storiesUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${uuid()}${ext}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Only JPG, PNG, WEBP, GIF images and MP4, WEBM, MOV videos (up to 30MB) are allowed.',
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@ApiTags('Stories')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Create a 24-hour ephemeral story (photo, video max 30s, or text)',
    type: CreateStoryDto,
  })
  @ApiResponse({ status: 201, description: 'Story created successfully.' })
  @Post()
  @UseInterceptors(FileInterceptor('media', storyMediaMulterOptions))
  async createStory(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateStoryDto,
    @Req() req: Request,
  ) {
    const currentUserId = req['user']._id.toString();
    const hostBaseUrl = `${req.protocol}://${req.get('host')}`;
    return this.storiesService.createStory(
      currentUserId,
      dto,
      file,
      hostBaseUrl,
    );
  }

  @ApiResponse({ status: 200, description: 'Get stories feed grouped by user.' })
  @Get('feed')
  async getStoriesFeed(@Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.getStoriesFeed(currentUserId);
  }

  @ApiResponse({ status: 200, description: 'Get user close friends list.' })
  @Get('close-friends')
  async getCloseFriends(@Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.getCloseFriends(currentUserId);
  }

  @ApiResponse({ status: 200, description: 'Update user close friends list.' })
  @Put('close-friends')
  async updateCloseFriends(
    @Body() dto: UpdateCloseFriendsDto,
    @Req() req: Request,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.updateCloseFriends(
      currentUserId,
      dto.closeFriendIds,
    );
  }

  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story marked as viewed.' })
  @Post(':id/view')
  async markStoryViewed(@Param('id') storyId: string, @Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.markStoryViewed(storyId, currentUserId);
  }

  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Get paginated viewers for user story.' })
  @Get(':id/viewers')
  async getStoryViewers(
    @Param('id') storyId: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.getStoryViewers(
      storyId,
      currentUserId,
      Number(page),
      Number(limit),
    );
  }

  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'React to a story.' })
  @Post(':id/react')
  async reactToStory(
    @Param('id') storyId: string,
    @Body() dto: ReactStoryDto,
    @Req() req: Request,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.reactToStory(
      storyId,
      currentUserId,
      dto.reaction,
    );
  }

  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Reply to a story in 1-on-1 chat.' })
  @Post(':id/reply')
  async replyToStory(
    @Param('id') storyId: string,
    @Body() dto: ReplyStoryDto,
    @Req() req: Request,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.replyToStory(
      storyId,
      currentUserId,
      dto.message,
    );
  }

  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story deleted successfully.' })
  @Delete(':id')
  async deleteStory(@Param('id') storyId: string, @Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.storiesService.deleteStory(storyId, currentUserId);
  }
}
