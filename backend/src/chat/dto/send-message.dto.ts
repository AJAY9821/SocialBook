import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: '65f1234567890abcdef12345',
    description: 'MongoDB ObjectId of the friend recipient',
  })
  @IsMongoId({ message: 'recipientId must be a valid MongoDB ObjectId.' })
  @IsNotEmpty({ message: 'recipientId is required.' })
  recipientId: string;

  @ApiProperty({
    example: 'Hey, are you free for a call?',
    description: 'Text content of the message',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty.' })
  @MaxLength(2000, { message: 'Message content cannot exceed 2000 characters.' })
  content: string;
}
