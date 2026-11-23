import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyStoryDto {
  @ApiProperty({ example: 'Looks amazing!', description: 'Text reply to the story' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Reply message cannot be empty.' })
  @MaxLength(1000, { message: 'Reply message cannot exceed 1000 characters.' })
  message: string;
}
