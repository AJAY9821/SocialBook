import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiPropertyOptional({
    example: 'Updated comment text!',
    description: 'Updated comment text (optional if GIF is present)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Comment cannot exceed 2000 characters.' })
  content?: string;

  @ApiPropertyOptional({
    example: 'https://media.tenor.com/xxx/tenor.gif',
    description: 'URL of the animated GIF (null or empty string to remove GIF)',
  })
  @IsOptional()
  @IsString()
  gifUrl?: string | null;

  @ApiPropertyOptional({
    example: 'gif',
    enum: ['text', 'gif'],
    description: 'Comment type',
  })
  @IsOptional()
  @IsString()
  commentType?: string;
}
