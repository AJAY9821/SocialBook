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
import { Request } from 'express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { AuthGuard } from 'src/middlewares';
import { ChatService } from './chat.service';
import { SendAudioMessageDto, SendMessageDto } from './dto';

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
]);

const audioMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const audioUploadDir = path.join(process.cwd(), 'uploads', 'audio');
      if (!fs.existsSync(audioUploadDir)) {
        fs.mkdirSync(audioUploadDir, { recursive: true });
      }
      cb(null, audioUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.webm';
      cb(null, `${uuid()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Only audio files (webm, ogg, mp4, wav, mp3, m4a up to 10MB) are allowed.',
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiResponse({ status: 201, description: 'Message sent successfully.' })
  @Post('messages')
  async sendMessage(@Req() req: Request, @Body() dto: SendMessageDto) {
    const userId = req['user']._id.toString();
    return this.chatService.sendMessage(userId, dto);
  }

  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Voice audio note sent successfully.' })
  @Post('messages/audio')
  @UseInterceptors(FileInterceptor('audio', audioMulterOptions))
  async sendAudioMessage(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SendAudioMessageDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required.');
    }
    const userId = req['user']._id.toString();
    const hostBaseUrl = `${req.protocol}://${req.get('host')}`;
    return this.chatService.sendAudioMessage(userId, dto, file, hostBaseUrl);
  }

  @ApiResponse({
    status: 200,
    description: 'Returns all conversation threads with latest message & unread badge.',
  })
  @Get('conversations')
  async getConversations(@Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.chatService.getConversations(userId);
  }

  @ApiResponse({
    status: 200,
    description: 'Returns total count of unread incoming messages.',
  })
  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.chatService.getUnreadCount(userId);
  }

  @ApiParam({ name: 'friendId', description: 'Friend User ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated chat history with a friend and marks incoming as read.',
  })
  @Get('messages/:friendId')
  async getChatHistory(
    @Param('friendId') friendId: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req['user']._id.toString();
    return this.chatService.getChatHistory(
      userId,
      friendId,
      Number(page),
      Number(limit),
    );
  }

  @ApiParam({ name: 'friendId', description: 'Friend User ID' })
  @ApiResponse({ status: 200, description: 'Marks all messages from this friend as read.' })
  @Patch('messages/:friendId/read')
  async markAsRead(
    @Param('friendId') friendId: string,
    @Req() req: Request,
  ) {
    const userId = req['user']._id.toString();
    return this.chatService.markAsRead(userId, friendId);
  }
}
