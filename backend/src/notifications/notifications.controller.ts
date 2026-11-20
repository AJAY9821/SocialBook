import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from 'src/middlewares';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiResponse({
    status: 200,
    description: 'Fetches recent notifications and badge counts for the logged-in user.',
  })
  @Get()
  async getNotifications(@Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.notificationsService.getNotifications(userId);
  }

  @ApiParam({ name: 'id', description: 'Notification ID to mark as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.notificationsService.markAsRead(userId, id);
  }

  @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const userId = req['user']._id.toString();
    return this.notificationsService.markAllAsRead(userId);
  }
}
