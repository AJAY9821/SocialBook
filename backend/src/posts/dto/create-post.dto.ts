import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    example: 'Hello everyone! Just started building a social media app with NestJS.',
    description: 'Text content of the post',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Post content cannot be empty.' })
  @MaxLength(5000, { message: 'Post content cannot exceed 5000 characters.' })
  content: string;
}
