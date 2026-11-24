import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/middlewares';
import { AIService } from './ai.service';
import {
  GenerateCaptionDto,
  GenerateHashtagsDto,
  PolishContentDto,
} from './dto';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @ApiOperation({
    summary: 'Polish post content with specified tone',
    description:
      'Rewrites draft in professional, engaging/viral, casual, grammar-fix, or short tone.',
  })
  @ApiResponse({ status: 200, description: 'Returns polished content and hashtags.' })
  @Post('polish')
  async polish(@Body() dto: PolishContentDto) {
    return this.aiService.polishContent(dto);
  }

  @ApiOperation({
    summary: 'Generate trending hashtags for content',
    description: 'Extracts relevant, high-reach hashtags based on draft keywords and context.',
  })
  @ApiResponse({ status: 200, description: 'Returns an array of hashtags.' })
  @Post('hashtags')
  async generateHashtags(@Body() dto: GenerateHashtagsDto) {
    return this.aiService.generateHashtags(dto);
  }

  @ApiOperation({
    summary: 'Generate creative post captions from scratch',
    description: 'Takes a short prompt or topic and returns 3 engaging caption options.',
  })
  @ApiResponse({ status: 200, description: 'Returns 3 caption options and matching hashtags.' })
  @Post('generate-caption')
  async generateCaption(@Body() dto: GenerateCaptionDto) {
    return this.aiService.generateCaption(dto);
  }
}
