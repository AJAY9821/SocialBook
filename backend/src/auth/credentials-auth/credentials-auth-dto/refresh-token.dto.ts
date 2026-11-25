import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { BaseResponse } from 'src/utils/responses';

export class RefreshTokenReqDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...',
    description: 'The refresh token issued during login',
  })
  @IsString({ message: 'Refresh token must be a string.' })
  @IsNotEmpty({ message: 'Refresh token is required.' })
  refreshToken: string;
}

export class RefreshTokenResDto extends BaseResponse {
  @ApiProperty({
    example: 'Session refreshed successfully!',
  })
  msg: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken?: string;

  @ApiProperty({
    example: '2026-11-25T17:00:00.000Z',
  })
  expiry: Date;
}
