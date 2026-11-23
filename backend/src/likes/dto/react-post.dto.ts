import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { REACTION_TYPE } from 'models/like';

export class ReactPostDto {
  @ApiPropertyOptional({
    enum: REACTION_TYPE,
    default: REACTION_TYPE.LIKE,
    description: 'Reaction type: like, love, haha, wow, sad, angry',
  })
  @IsOptional()
  @IsEnum(REACTION_TYPE, {
    message: 'Reaction must be one of: like, love, haha, wow, sad, angry',
  })
  reactionType?: REACTION_TYPE;
}
