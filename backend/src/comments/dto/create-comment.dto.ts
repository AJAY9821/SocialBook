import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiPropertyOptional({
    example: 'Great post! Really enjoyed reading this.',
    description: 'Comment text (optional if sending a GIF)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Comment content cannot exceed 2000 characters.' })
  content?: string;

  @ApiPropertyOptional({
    example: 'text',
    enum: ['text', 'gif'],
    description: 'Type of comment',
  })
  @IsOptional()
  @IsString()
  commentType?: string;

  @ApiPropertyOptional({
    example: 'https://media.tenor.com/xxx/tenor.gif',
    description: 'URL of the animated GIF',
  })
  @IsOptional()
  @IsString()
  gifUrl?: string;

  @ApiPropertyOptional({
    example: '65f1a2b3c4d5e6f7a8b9c0d1',
    description: 'Parent comment ID if this is a reply to another comment',
  })
  @IsOptional()
  @IsMongoId({ message: 'Parent comment ID must be a valid MongoDB ObjectId.' })
  parentComment?: string;

  @ApiPropertyOptional({
    example: '65f1a2b3c4d5e6f7a8b9c0d1',
    description: 'Legacy alias for parent comment ID',
  })
  @IsOptional()
  @IsMongoId({ message: 'Parent comment ID must be a valid MongoDB ObjectId.' })
  parentId?: string;
}
