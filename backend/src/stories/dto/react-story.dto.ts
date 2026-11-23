import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReactStoryDto {
  @ApiProperty({ example: '🔥', description: 'Emoji reaction for the story' })
  @IsString()
  @IsNotEmpty({ message: 'Reaction cannot be empty.' })
  @MaxLength(10, { message: 'Reaction cannot exceed 10 characters.' })
  reaction: string;
}
