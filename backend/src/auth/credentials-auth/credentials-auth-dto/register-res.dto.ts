import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from 'src/user/user/user-dto';
import { BaseResponse } from 'src/utils/responses';

export class RegisterResDto extends BaseResponse {
  @ApiProperty({
    description: 'Message to be sent in the response',
    example: 'Registration complete! You can now log in.',
  })
  msg: string;

  @ApiProperty({
    type: UserProfileDto,
    required: false,
  })
  user?: UserProfileDto;
}
