import {
  Body,
  Controller,
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
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from 'src/middlewares';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto';

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
