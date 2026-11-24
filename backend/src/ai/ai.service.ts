import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  GenerateCaptionDto,
  GenerateHashtagsDto,
  POLISH_TONE,
  PolishContentDto,
} from './dto';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private aiClient: GoogleGenAI | null = null;
  private apiKey: string = '';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (this.apiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: this.apiKey });
        this.logger.log('Google Gemini AI initialized successfully.');
      } catch (err) {
        this.logger.warn(
          'Failed to initialize Google GenAI client, falling back to smart NLP engine.',
          err,
        );
      }
    } else {
      this.logger.log(
        'GEMINI_API_KEY is not set. Using smart built-in NLP engine for post polishing and hashtags.',
      );
    }
  }

  /**
   * Polish post content with specified tone
   */
  async polishContent(dto: PolishContentDto) {
    if (this.aiClient && this.apiKey) {
      try {
        return await this.callGeminiPolish(dto);
      } catch (err) {
        this.logger.warn(
          'Gemini API request failed, falling back to built-in smart engine:',
          err,
        );
      }
    }

    return this.fallbackPolish(dto);
  }

  /**
   * Generate trending & relevant hashtags
   */
  async generateHashtags(dto: GenerateHashtagsDto) {
    if (this.aiClient && this.apiKey) {
      try {
        return await this.callGeminiHashtags(dto);
      } catch (err) {
        this.logger.warn(
          'Gemini hashtags request failed, falling back to built-in smart engine:',
          err,
        );
      }
    }

    return this.fallbackHashtags(dto);
  }

  /**
   * Generate creative caption variations from a prompt or topic
   */
  async generateCaption(dto: GenerateCaptionDto) {
    if (this.aiClient && this.apiKey) {
      try {
        return await this.callGeminiCaption(dto);
      } catch (err) {
        this.logger.warn(
          'Gemini caption request failed, falling back to built-in smart engine:',
          err,
        );
      }
    }

    return this.fallbackCaption(dto);
  }

  // -------------------------------------------------------------------------
  // GEMINI API INTEGRATIONS
  // -------------------------------------------------------------------------

  /**
   * Helper that executes content generation with model fallback support
   */
  private async generateWithGemini(contents: string, config: any) {
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
    ];

    let lastError: any = null;
    for (const model of candidateModels) {
      try {
        const response = await this.aiClient!.models.generateContent({
          model,
          contents,
          config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        this.logger.warn(
          `Gemini model ${model} failed (${err?.message || err}). Trying fallback candidate...`,
        );
      }
    }
    throw lastError;
  }

  private async callGeminiPolish(dto: PolishContentDto) {
    const toneInstructions: Record<POLISH_TONE, string> = {
      [POLISH_TONE.FIX_GRAMMAR]:
        'Fix all grammar, spelling, punctuation and typos (e.g. smll -> small) while strictly preserving the author voice, personality, and meaning.',
      [POLISH_TONE.PROFESSIONAL]:
        'Rewrite in an articulate, professional, well-structured, and clear tone suitable for LinkedIn or tech discussions.',
      [POLISH_TONE.ENGAGING]:
        'Rewrite to maximize social engagement: start with a hook, format with breathable line breaks, add relevant emojis, and end with an engaging question for readers.',
      [POLISH_TONE.CASUAL]:
        'Rewrite in a fun, relaxed, friendly, and conversational tone with expressive emojis.',
      [POLISH_TONE.SHORT]:
        'Condense the draft into a concise, punchy 1-2 sentence high-impact summary.',
    };

    const prompt = `You are a social media copywriter and editor.
Instruction: ${toneInstructions[dto.tone] || toneInstructions[POLISH_TONE.ENGAGING]}
${dto.includeEmojis === false ? 'Do NOT include emojis.' : 'Use tasteful, modern emojis.'}

Draft to polish:
"""
${dto.content}
"""

You must respond ONLY with a valid JSON object matching this exact structure:
{
  "polishedContent": "the rewritten polished version",
  "explanation": "one sentence explaining the improvements made",
  "suggestedHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;

    const response = await this.generateWithGemini(prompt, {
      responseMimeType: 'application/json',
      temperature: dto.tone === POLISH_TONE.FIX_GRAMMAR ? 0.2 : 0.7,
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      error: false,
      statusCode: HttpStatus.OK,
      polishedContent: parsed.polishedContent || dto.content,
      explanation: parsed.explanation || `Polished in ${dto.tone} tone`,
      suggestedHashtags: Array.isArray(parsed.suggestedHashtags)
        ? parsed.suggestedHashtags
        : this.extractKeywordsAsHashtags(dto.content),
      isAiPowered: true,
    };
  }

  private async callGeminiHashtags(dto: GenerateHashtagsDto) {
    const count = dto.limit || 8;
    const prompt = `You are a social media growth expert.
Extract ${count} highly relevant, viral, and discovery-friendly hashtags for this post:
"""
${dto.content}
"""

Rules:
- Include a mix of broad trending tags and targeted niche tags.
- Each hashtag must start with '#'.
- Avoid spaces or special characters in the tags.

Respond ONLY with a valid JSON object matching this structure:
{
  "hashtags": ["#tag1", "#tag2", ...]
}`;

    const response = await this.generateWithGemini(prompt, {
      responseMimeType: 'application/json',
      temperature: 0.6,
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      error: false,
      statusCode: HttpStatus.OK,
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags
        : this.extractKeywordsAsHashtags(dto.content, count),
      isAiPowered: true,
    };
  }

  private async callGeminiCaption(dto: GenerateCaptionDto) {
    const prompt = `You are a creative social media writer.
Generate 3 distinct, engaging post captions based on this topic:
Topic: "${dto.prompt}"
Style preference: ${dto.style || 'short'}

Requirements:
1. Caption 1: Catchy and concise with matching emojis.
2. Caption 2: Storytelling / descriptive perspective with great hook.
3. Caption 3: Inquisitive question-based caption to drive comments.
Also provide 5 relevant hashtags.

Respond ONLY with a valid JSON object matching this structure:
{
  "captions": ["Caption 1...", "Caption 2...", "Caption 3..."],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;

    const response = await this.generateWithGemini(prompt, {
      responseMimeType: 'application/json',
      temperature: 0.75,
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      error: false,
      statusCode: HttpStatus.OK,
      captions: Array.isArray(parsed.captions)
        ? parsed.captions
        : this.fallbackCaption(dto).captions,
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags
        : this.extractKeywordsAsHashtags(dto.prompt, 5),
      isAiPowered: true,
    };
  }

  // -------------------------------------------------------------------------
  // SMART NLP FALLBACK ENGINE (Zero-Key Dev Mode)
  // -------------------------------------------------------------------------

  private fallbackPolish(dto: PolishContentDto) {
    let text = dto.content.trim();

    // 1. Fix common typos & contractions
    const typoReplacements: [RegExp, string][] = [
      [/\bsmll\b/gi, 'small'],
      [/\bgrammer\b/gi, 'grammar'],
      [/\bteh\b/gi, 'the'],
      [/\brecieve\b/gi, 'receive'],
      [/\bseperate\b/gi, 'separate'],
      [/\bdefinately\b/gi, 'definitely'],
      [/\bbeautifull\b/gi, 'beautiful'],
      [/\buntill\b/gi, 'until'],
      [/\bwierd\b/gi, 'weird'],
      [/\bthier\b/gi, 'their'],
      [/\bbeleive\b/gi, 'believe'],
      [/\balot\b/gi, 'a lot'],
      [/\btommorow\b/gi, 'tomorrow'],
      [/\btommorrow\b/gi, 'tomorrow'],
      [/\bfreind\b/gi, 'friend'],
      [/\bdont\b/gi, "don't"],
      [/\bcant\b/gi, "can't"],
      [/\bwont\b/gi, "won't"],
      [/\bim\b/gi, "I'm"],
      [/\bive\b/gi, "I've"],
      [/\bidk\b/gi, "I don't know"],
      [/\btbh\b/gi, 'to be honest'],
      [/\brn\b/gi, 'right now'],
      [/\bu\b/gi, 'you'],
      [/\bur\b/gi, 'your'],
      [/\bpls\b/gi, 'please'],
      [/\bthx\b/gi, 'thanks'],
    ];

    for (const [regex, replacement] of typoReplacements) {
      text = text.replace(regex, replacement);
    }

    // 2. Clean odd punctuation like double periods or period directly after emoji
    text = text.replace(/([.!?])\s*\./g, '$1');
    text = text.replace(/([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}])\s*\./gu, '$1');

    // 3. Capitalize sentences
    text = text.replace(/(^\s*|\.\s+)([a-z])/g, (_, sep, char) => sep + char.toUpperCase());

    // 4. Ensure sentence ends with punctuation
    if (!/[.!?\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]$/u.test(text)) {
      text += '.';
    }

    let polished = text;

    switch (dto.tone) {
      case POLISH_TONE.PROFESSIONAL:
        polished = `${text} Excited to share these thoughts and continuously learn along the journey.`;
        break;
      case POLISH_TONE.ENGAGING:
        polished = `✨ Quick insight:\n\n${text}\n\nWhat are your thoughts on this? Drop your perspective in the comments below! 👇`;
        break;
      case POLISH_TONE.CASUAL:
        polished = `${text} 😊 Loving how everything is coming together! 🙌`;
        break;
      case POLISH_TONE.SHORT:
        polished = text.split(/[.!?]/)[0] + '.';
        break;
      case POLISH_TONE.FIX_GRAMMAR:
      default:
        polished = text;
        break;
    }

    const hashtags = this.extractKeywordsAsHashtags(text, 6);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      polishedContent: polished,
      explanation: `Polished in ${dto.tone} mode (Built-in NLP Engine)`,
      suggestedHashtags: hashtags,
      isAiPowered: false,
    };
  }

  private fallbackHashtags(dto: GenerateHashtagsDto) {
    const hashtags = this.extractKeywordsAsHashtags(dto.content, dto.limit || 8);
    return {
      error: false,
      statusCode: HttpStatus.OK,
      hashtags,
      isAiPowered: false,
    };
  }

  private fallbackCaption(dto: GenerateCaptionDto) {
    const prompt = dto.prompt.trim();
    const capitalized = prompt.charAt(0).toUpperCase() + prompt.slice(1);
    const hashtags = this.extractKeywordsAsHashtags(prompt, 6);

    const captions = [
      `✨ ${capitalized}! Life is made of small moments like these. 🌟`,
      `Making the most of every second: ${prompt}. What's inspiring you today? Let's connect below! 👇`,
      `${capitalized}. Keep moving forward, keep growing. 🚀`,
    ];

    return {
      error: false,
      statusCode: HttpStatus.OK,
      captions,
      hashtags,
      isAiPowered: false,
    };
  }

  /**
   * Helper: Match keywords in text to categorized trending hashtags
   */
  private extractKeywordsAsHashtags(content: string, limit = 8): string[] {
    const lower = content.toLowerCase();
    const tags = new Set<string>();

    const dictionary: Record<string, string[]> = {
      code: ['#Coding', '#WebDev', '#SoftwareEngineer', '#CodeLife'],
      dev: ['#Developer', '#FullStack', '#TechCommunity', '#Software'],
      tech: ['#Technology', '#TechNews', '#Innovation', '#Digital'],
      react: ['#ReactJS', '#Frontend', '#WebDesign', '#JavaScript'],
      nest: ['#NestJS', '#Backend', '#TypeScript', '#NodeJS'],
      typescript: ['#TypeScript', '#CleanCode', '#WebDev'],
      ai: ['#ArtificialIntelligence', '#MachineLearning', '#TechTrends', '#AI'],
      photo: ['#Photography', '#PhotoOfTheDay', '#Visuals', '#Picoftheday'],
      video: ['#VideoContent', '#Cinematic', '#Reels', '#VideoOfTheDay'],
      travel: ['#TravelDiaries', '#Wanderlust', '#ExploreMore', '#Adventure'],
      sunset: ['#SunsetLovers', '#GoldenHour', '#SkyScapes', '#EveningVibes'],
      coffee: ['#CoffeeLover', '#CafeVibes', '#MorningFuel', '#CoffeeTime'],
      gym: ['#FitnessMotivation', '#WorkoutDaily', '#HealthyLifestyle', '#GymLife'],
      food: ['#Foodie', '#FoodPhotography', '#Delicious', '#TasteOfGoodLife'],
      weekend: ['#WeekendVibes', '#SaturdayMood', '#RelaxTime', '#SundayFunday'],
      friend: ['#FriendshipGoals', '#GoodTimes', '#Squad', '#Memories'],
      music: ['#NowPlaying', '#MusicIsLife', '#GoodVibes', '#Soundtrack'],
      work: ['#WorkLife', '#Productivity', '#CareerGrowth', '#Hustle'],
    };

    for (const [key, categoryTags] of Object.entries(dictionary)) {
      if (lower.includes(key)) {
        categoryTags.forEach((tag) => tags.add(tag));
      }
    }

    // Default general tags if few keywords matched
    const defaults = ['#Community', '#Inspiration', '#DailyVibes', '#Trending', '#Growth'];
    for (const tag of defaults) {
      if (tags.size >= limit) break;
      tags.add(tag);
    }

    return Array.from(tags).slice(0, limit);
  }
}
