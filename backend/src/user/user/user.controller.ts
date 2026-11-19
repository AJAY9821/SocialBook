import {
  BadRequestException,
  Body,
  Controller,
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
import { ErrorResponse } from 'src/utils/responses';
import { UserService } from './user.service';
import { Request } from 'express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { GetUserProfileResDTO, UpdateProfileReqDto } from './user-dto';
import { AuthGuard } from 'src/middlewares';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const profileImageMulterOptions = {
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

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the logged-in user profile.',
    type: GetUserProfileResDTO,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponse,
  })
  @Get('profile')
  async getUserProfile(@Req() req: Request) {
    const user = req['user'];
    return this.userService.getUserProfile(user);
  }

  @ApiResponse({
    status: 200,
    description: 'Successfully updated the logged-in user profile.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ErrorResponse,
  })
  @Patch('profile')
  async updateProfile(
    @Req() req: Request,
    @Body() updateData: UpdateProfileReqDto,
  ) {
    const user = req['user'];
    return this.userService.updateProfile(user._id.toString(), updateData);
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Profile photo uploaded.' })
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('image', profileImageMulterOptions))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Please select an image file to upload.');
    }
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const user = req['user'];
    return this.userService.updateProfileImage(user._id.toString(), {
      avatarUrl,
    });
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Cover photo uploaded.' })
  @Post('profile/cover')
  @UseInterceptors(FileInterceptor('image', profileImageMulterOptions))
  async uploadCover(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Please select an image file to upload.');
    }
    const coverUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const user = req['user'];
    return this.userService.updateProfileImage(user._id.toString(), {
      coverUrl,
    });
  }

  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search users by name or email',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns matching users.',
  })
  @Get('search')
  async searchUsers(@Query('q') query: string, @Req() req: Request) {
    const user = req['user'];
    return this.userService.searchUsers(query, user._id.toString());
  }

  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved user profile by ID.',
    type: GetUserProfileResDTO,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponse,
  })
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }
}
