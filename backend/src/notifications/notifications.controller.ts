import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
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
}
