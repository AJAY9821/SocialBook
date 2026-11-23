import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'Updated post text!',
    description: 'Updated text content of the post',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Post content cannot be empty.' })
  @MaxLength(5000, { message: 'Post content cannot exceed 5000 characters.' })
  content?: string;

  @ApiPropertyOptional({
    example: 45,
    description: 'Video duration in seconds if attaching a video',
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  @IsNumber()
  videoDuration?: number;
}
