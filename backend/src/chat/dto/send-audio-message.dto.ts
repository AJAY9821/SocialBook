import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SendAudioMessageDto {
  @ApiProperty({
    example: '65f1234567890abcdef12345',
    description: 'MongoDB ObjectId of the friend recipient',
  })
  @IsMongoId({ message: 'recipientId must be a valid MongoDB ObjectId.' })
  @IsNotEmpty({ message: 'recipientId is required.' })
  recipientId: string;

  @ApiProperty({
    example: 12.5,
    description: 'Recorded audio duration in seconds',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'duration must be a valid number.' })
  @Min(0.5, { message: 'Audio duration must be at least 0.5 seconds.' })
  @Max(300, { message: 'Audio duration cannot exceed 300 seconds (5 minutes).' })
  duration: number;

  @ApiPropertyOptional({
    example: '[10, 25, 40, 80, 60, 30]',
    description: 'Optional JSON stringified array of amplitude values for waveform preview',
  })
  @IsOptional()
  @IsString()
  waveform?: string;
}
