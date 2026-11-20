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
  @ApiProperty({
    example: 'Great post! Really enjoyed reading this.',
    description: 'Comment text',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Comment content cannot be empty.' })
  @MaxLength(2000, { message: 'Comment cannot exceed 2000 characters.' })
  content: string;

  @ApiPropertyOptional({
    example: '65f1a2b3c4d5e6f7a8b9c0d1',
    description: 'Parent comment ID if this is a reply to another comment',
  })
  @IsOptional()
  @IsMongoId({ message: 'Parent comment ID must be a valid MongoDB ObjectId.' })
  parentId?: string;
}
