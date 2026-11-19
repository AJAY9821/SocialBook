import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileReqDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters long.' })
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'Full Stack Developer learning NestJS.' })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Bio cannot exceed 300 characters.' })
  bio?: string;

  @ApiPropertyOptional({ example: 'Bengaluru, India' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: 'https://johndoe.dev' })
  @IsOptional()
  @IsUrl({}, { message: 'website must be a valid URL.' })
  @MaxLength(200)
  website?: string;
}
