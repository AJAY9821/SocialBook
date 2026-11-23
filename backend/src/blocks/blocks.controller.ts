import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from 'src/middlewares';
import { BlocksService } from './blocks.service';

@ApiTags('Blocks')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @ApiParam({ name: 'userId', description: 'User ID to block' })
  @ApiResponse({ status: 201, description: 'User blocked successfully.' })
  @Post(':userId')
  async blockUser(@Param('userId') targetUserId: string, @Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.blocksService.blockUser(currentUserId, targetUserId);
  }

  @ApiParam({ name: 'userId', description: 'User ID to unblock' })
  @ApiResponse({ status: 200, description: 'User unblocked successfully.' })
  @Delete(':userId')
  async unblockUser(@Param('userId') targetUserId: string, @Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.blocksService.unblockUser(currentUserId, targetUserId);
  }

  @ApiResponse({ status: 200, description: 'List of all blocked users.' })
  @Get()
  async getBlockedUsers(@Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.blocksService.getBlockedUsers(currentUserId);
  }

  @ApiParam({ name: 'userId', description: 'User ID to check block status' })
  @ApiResponse({ status: 200, description: 'Block status between current user and target user.' })
  @Get('status/:userId')
  async getBlockStatus(@Param('userId') targetUserId: string, @Req() req: Request) {
    const currentUserId = req['user']._id.toString();
    return this.blocksService.getBlockStatus(currentUserId, targetUserId);
  }
}
