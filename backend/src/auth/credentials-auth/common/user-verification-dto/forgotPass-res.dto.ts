import { ApiProperty } from '@nestjs/swagger';
import { BaseResponse } from 'src/utils/responses';

export class forgotPassResDTO extends BaseResponse {
  @ApiProperty({
    description: 'Message indicating the status of the forgot password request',
    example: 'Password reset link sent successfully',
  })
  msg: string;

  @ApiProperty({
    description: 'Development reset token (for testing without email keys)',
    required: false,
  })
  resetToken?: string;

  @ApiProperty({
    description: 'Development reset link (for testing without email keys)',
    required: false,
  })
  resetLink?: string;
}
