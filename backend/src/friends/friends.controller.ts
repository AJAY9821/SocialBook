import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from 'src/middlewares';
import { FriendsService } from './friends.service';

@ApiTags('Friends')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @ApiParam({ name: 'recipientId', description: 'User ID to send request to' })
  @ApiResponse({ status: 201, description: 'Friend request sent.' })
  @Post('request/:recipientId')
  async sendFriendRequest(
    @Param('recipientId') recipientId: string,
    @Req() req: Request,
  ) {
    const requesterId = req['user']._id.toString();
    return this.friendsService.sendFriendRequest(requesterId, recipientId);
  }

  @ApiParam({ name: 'requestId', description: 'Friend request ID' })
  @ApiResponse({ status: 200, description: 'Friend request accepted.' })
  @Patch('request/:requestId/accept')
  async acceptFriendRequest(
    @Param('requestId') requestId: string,
    @Req() req: Request,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.friendsService.acceptFriendRequest(requestId, currentUserId);
  }

  @ApiParam({ name: 'requestId', description: 'Friend request ID' })
  @ApiResponse({ status: 200, description: 'Friend request rejected.' })
  @Patch('request/:requestId/reject')
  async rejectFriendRequest(
    @Param('requestId') requestId: string,
    @Req() req: Request,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.friendsService.rejectFriendRequest(requestId, currentUserId);
  }

  @ApiParam({ name: 'requestId', description: 'Friend request ID to cancel' })
  @ApiResponse({ status: 200, description: 'Friend request cancelled.' })
  @Delete('request/:requestId')
  async cancelFriendRequest(
    @Param('requestId') requestId: string,
    @Req() req: Request,
  ) {
    const currentUserId = req['user']._id.toString();
    return this.friendsService.cancelFriendRequest(requestId, currentUserId);
  }

  @ApiResponse({
    status: 200,
    description: 'List pending incoming friend requests.',
  })
  @Get('requests/incoming')
  async getIncomingRequests(@Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.friendsService.getIncomingRequests(currentUserId);
  }

  @ApiResponse({
    status: 200,
    description: 'List pending outgoing friend requests.',
  })
  @Get('requests/outgoing')
  async getOutgoingRequests(@Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.friendsService.getOutgoingRequests(currentUserId);
  }

  @ApiResponse({ status: 200, description: 'List accepted friends.' })
  @Get()
  async getFriendsList(@Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.friendsService.getFriendsList(currentUserId);
  }

  @ApiParam({ name: 'friendId', description: 'User ID of the friend to remove' })
  @ApiResponse({ status: 200, description: 'Friend removed successfully.' })
  @Delete(':friendId')
  async unfriend(@Param('friendId') friendId: string, @Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.friendsService.unfriend(friendId, currentUserId);
  }
}
