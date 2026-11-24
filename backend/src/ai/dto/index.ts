import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum POLISH_TONE {
  FIX_GRAMMAR = 'fix_grammar',
  PROFESSIONAL = 'professional',
  ENGAGING = 'engaging',
  CASUAL = 'casual',
  SHORT = 'short',
}

export class PolishContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  content: string;

  @IsEnum(POLISH_TONE, {
    message:
      'Tone must be one of: fix_grammar, professional, engaging, casual, short',
  })
  tone: POLISH_TONE;

  @IsOptional()
  @IsBoolean()
  includeEmojis?: boolean;
}

export class GenerateHashtagsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  content: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(25)
  limit?: number = 8;
}

export class GenerateCaptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  prompt: string;

  @IsOptional()
  @IsIn(['short', 'story', 'inquisitive'])
  style?: 'short' | 'story' | 'inquisitive' = 'short';
}
