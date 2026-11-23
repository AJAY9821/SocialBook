import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateCloseFriendsDto {
  @ApiProperty({ type: [String], description: 'List of user IDs for close friends' })
  @IsArray()
  @IsString({ each: true })
  closeFriendIds: string[];
}
