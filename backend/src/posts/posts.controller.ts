import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
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
import { PostsService } from './posts.service';
import { CreatePostDto, SharePostDto, UpdatePostDto } from './dto';

const ALLOWED_POST_MEDIA_MIME_TYPES = new Set([
  // Images (Max 10MB)
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  // Videos (Max 50MB)
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

const postMediaMulterOptions = {
  storage: diskStorage({
    destination: (_req, file, cb) => {
      const isVideo = file.mimetype.startsWith('video/');
      const subDir = isVideo
        ? path.join('posts', 'videos')
        : path.join('posts', 'images');
      const targetDir = path.join(process.cwd(), 'uploads', subDir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const isVideo = file.mimetype.startsWith('video/');
      const defaultExt = isVideo ? '.mp4' : '.jpg';
      const ext = path.extname(file.originalname).toLowerCase() || defaultExt;
      cb(null, `${uuid()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB hard limit for posts
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_POST_MEDIA_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Only JPG, PNG, WEBP, GIF images or MP4, WebM, MOV videos (up to 50MB) are allowed.',
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string' },
        image: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' },
        media: { type: 'string', format: 'binary' },
        videoDuration: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Post created successfully.' })
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 10 },
        { name: 'videos', maxCount: 3 },
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 },
        { name: 'media', maxCount: 10 },
      ],
      postMediaMulterOptions,
    ),
  )
  async createPost(
    @Req() req: Request,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles()
    files?: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
      image?: Express.Multer.File[];
      video?: Express.Multer.File[];
      media?: Express.Multer.File[];
    },
  ) {
    const userId = req['user']._id.toString();

    const mediaItems: Array<{ type: 'image' | 'video'; url: string; duration?: number }> = [];

    const getFileUrl = (file: Express.Multer.File, isVideo: boolean) => {
      const folder = isVideo ? 'videos' : 'images';
      return `${req.protocol}://${req.get('host')}/uploads/posts/${folder}/${file.filename}`;
    };

    const allImages: Express.Multer.File[] = [
      ...(files?.images || []),
      ...(files?.image || []),
      ...(files?.media?.filter((f) => f.mimetype.startsWith('image/')) || []),
    ];
    for (const f of allImages) {
      mediaItems.push({
        type: 'image',
        url: getFileUrl(f, false),
      });
    }

    const allVideos: Express.Multer.File[] = [
      ...(files?.videos || []),
      ...(files?.video || []),
      ...(files?.media?.filter((f) => f.mimetype.startsWith('video/')) || []),
    ];
    for (const f of allVideos) {
      mediaItems.push({
        type: 'video',
        url: getFileUrl(f, true),
        duration: createPostDto.videoDuration ? Number(createPostDto.videoDuration) : 0,
      });
    }

    const uploadedImageUrl = mediaItems.find((m) => m.type === 'image')?.url;
    const uploadedVideoUrl = mediaItems.find((m) => m.type === 'video')?.url;

    return this.postsService.createPost(
      userId,
      createPostDto,
      uploadedImageUrl,
      uploadedVideoUrl,
      mediaItems,
    );
  }

  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns social media feed (your posts + friends posts).',
  })
  @Get('feed')
  async getFeed(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req['user']._id.toString();
    return this.postsService.getFeed(userId, Number(page), Number(limit));
  }

  @ApiParam({ name: 'userId', description: 'Author user ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated posts by a specific user.',
  })
  @Get('user/:userId')
  async getUserPosts(
    @Param('userId') targetUserId: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.postsService.getUserPosts(
      targetUserId,
      currentUserId,
      Number(page),
      Number(limit),
    );
  }

  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of posts saved/bookmarked by the current user.',
  })
  @Get('saved')
  async getSavedPosts(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req['user']._id.toString();
    return this.postsService.getSavedPosts(userId, Number(page), Number(limit));
  }

  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Returns a single post by ID.' })
  @Get(':id')
  async getPostById(@Param('id') id: string, @Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.postsService.getPostById(id, currentUserId);
  }

  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        image: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' },
        media: { type: 'string', format: 'binary' },
        videoDuration: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Post updated successfully.' })
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 10 },
        { name: 'videos', maxCount: 3 },
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 },
        { name: 'media', maxCount: 10 },
      ],
      postMediaMulterOptions,
    ),
  )
  async updatePost(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFiles()
    files?: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
      image?: Express.Multer.File[];
      video?: Express.Multer.File[];
      media?: Express.Multer.File[];
    },
  ) {
    const userId = req['user']._id.toString();

    const mediaItems: Array<{ type: 'image' | 'video'; url: string; duration?: number }> = [];

    const getFileUrl = (file: Express.Multer.File, isVideo: boolean) => {
      const folder = isVideo ? 'videos' : 'images';
      return `${req.protocol}://${req.get('host')}/uploads/posts/${folder}/${file.filename}`;
    };

    const allImages: Express.Multer.File[] = [
      ...(files?.images || []),
      ...(files?.image || []),
      ...(files?.media?.filter((f) => f.mimetype.startsWith('image/')) || []),
    ];
    for (const f of allImages) {
      mediaItems.push({
        type: 'image',
        url: getFileUrl(f, false),
      });
    }

    const allVideos: Express.Multer.File[] = [
      ...(files?.videos || []),
      ...(files?.video || []),
      ...(files?.media?.filter((f) => f.mimetype.startsWith('video/')) || []),
    ];
    for (const f of allVideos) {
      mediaItems.push({
        type: 'video',
        url: getFileUrl(f, true),
        duration: updatePostDto.videoDuration ? Number(updatePostDto.videoDuration) : 0,
      });
    }

    const uploadedImageUrl = mediaItems.find((m) => m.type === 'image')?.url;
    const uploadedVideoUrl = mediaItems.find((m) => m.type === 'video')?.url;

    return this.postsService.updatePost(
      id,
      userId,
      updatePostDto,
      uploadedImageUrl,
      uploadedVideoUrl,
      mediaItems,
    );
  }

  @ApiParam({ name: 'id', description: 'Post ID to share' })
  @ApiResponse({ status: 201, description: 'Post shared successfully to your feed.' })
  @Post(':id/share')
  async sharePost(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() sharePostDto: SharePostDto,
  ) {
    const userId = req['user']._id.toString();
    return this.postsService.sharePost(userId, id, sharePostDto);
  }

  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Increments the shares counter for a post (e.g. when shared in chat or via link).',
  })
  @Post(':id/share-count')
  async incrementShareCount(@Param('id') id: string) {
    return this.postsService.incrementShareCount(id);
  }

  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Toggles saved/bookmarked status for the post.',
  })
  @Post(':id/save')
  async toggleSavePost(@Param('id') id: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.postsService.toggleSavePost(userId, id);
  }

  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns whether the post is saved/bookmarked by the current user.',
  })
  @Get(':id/save-status')
  async getSaveStatus(@Param('id') id: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.postsService.getSaveStatus(userId, id);
  }

  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully.' })
  @Delete(':id')
  async deletePost(@Param('id') id: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.postsService.deletePost(id, userId);
  }
}
