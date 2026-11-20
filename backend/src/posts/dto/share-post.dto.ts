import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SharePostDto {
  @ApiPropertyOptional({
    example: 'Check out this awesome project!',
    description: 'Optional caption or thought to accompany the shared post',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(5000, { message: 'Caption cannot exceed 5000 characters.' })
  caption?: string;
}
