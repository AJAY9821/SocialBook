import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ROLE_VALUES, User } from 'models/user/user.schema';

export class UserProfileDto {
  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Full Stack Developer building cool apps.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ example: 'Mumbai, India' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://johndoe.dev' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isEmailVerified: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  isDeleted: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  isAccountCompleted: boolean;

  @ApiProperty({ example: ROLE_VALUES.USER, enum: ROLE_VALUES })
  @IsEnum(ROLE_VALUES)
  role: ROLE_VALUES;

  static transform(object: User): UserProfileDto {
    const transformedObj: UserProfileDto = new UserProfileDto();

    transformedObj.id = object._id.toString();
    transformedObj.email = object.email;
    transformedObj.name = object.name;
    transformedObj.bio = object.bio || '';
    transformedObj.avatarUrl = object.avatarUrl || '';
    transformedObj.coverUrl = object.coverUrl || '';
    transformedObj.location = object.location || '';
    transformedObj.website = object.website || '';
    transformedObj.isEmailVerified = object.isEmailVerified;
    transformedObj.isAccountCompleted = object.isAccountCompleted;
    transformedObj.isDeleted = object.isDeleted;
    transformedObj.role = object.role;

    return transformedObj;
  }
}
