import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StoryAudience, StoryMediaType } from 'models/story';

export class CreateStoryDto {
  @ApiProperty({ enum: StoryMediaType, example: StoryMediaType.IMAGE })
  @IsEnum(StoryMediaType, { message: 'Invalid mediaType. Must be image, video, or text.' })
  mediaType: StoryMediaType;

  @ApiPropertyOptional({ example: 'Beach day memories!' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Caption cannot exceed 500 characters.' })
  caption?: string;

  @ApiPropertyOptional({ example: 'from-pink-500 to-purple-600' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  backgroundColor?: string;

  @ApiPropertyOptional({ example: 15, description: 'Duration in seconds (max 30s)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 second.' })
  @Max(30, { message: 'Story video duration cannot exceed 30 seconds.' })
  duration?: number;

  @ApiPropertyOptional({ enum: StoryAudience, default: StoryAudience.ALL })
  @IsOptional()
  @IsEnum(StoryAudience)
  audience?: StoryAudience;

  @ApiPropertyOptional({
    description: 'Array of user IDs to exclude when audience is hide_from',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return value.split(',').map((id: string) => id.trim()).filter(Boolean);
      }
    }
    return [value];
  })
  customUserIds?: string[];
}
