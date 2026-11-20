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
import { PostsService } from './posts.service';
import { CreatePostDto, SharePostDto, UpdatePostDto } from './dto';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const postImageMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${uuid()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Only JPG, PNG, WEBP, and GIF images are allowed.',
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
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Post created successfully.' })
  @Post()
  @UseInterceptors(FileInterceptor('image', postImageMulterOptions))
  async createPost(
    @Req() req: Request,
    @Body() createPostDto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req['user']._id.toString();
    const uploadedImageUrl = file
      ? `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
      : undefined;

    return this.postsService.createPost(userId, createPostDto, uploadedImageUrl);
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
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Post updated successfully.' })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', postImageMulterOptions))
  async updatePost(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req['user']._id.toString();
    const uploadedImageUrl = file
      ? `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
      : undefined;

    return this.postsService.updatePost(
      id,
      userId,
      updatePostDto,
      uploadedImageUrl,
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
  @ApiResponse({ status: 200, description: 'Post deleted successfully.' })
  @Delete(':id')
  async deletePost(@Param('id') id: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.postsService.deletePost(id, userId);
  }
}
