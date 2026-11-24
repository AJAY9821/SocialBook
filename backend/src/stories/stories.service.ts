import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Story, StoryAudience, StoryMediaType } from 'models/story';
import { User } from 'models/user';
import { FRIENDSHIP_STATUS, Friendship } from 'models/friendship';
import { ChatService } from 'src/chat/chat.service';
import { BlocksService } from 'src/blocks/blocks.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { ReactStoryDto } from './dto/react-story.dto';
import { ReplyStoryDto } from './dto/reply-story.dto';

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<Story>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<Friendship>,
    private readonly chatService: ChatService,
    private readonly blocksService: BlocksService,
  ) {}

  async createStory(
    userId: string,
    dto: CreateStoryDto,
    file?: Express.Multer.File,
    hostBaseUrl?: string,
  ) {
    const userObjectId = new Types.ObjectId(userId);

    let mediaUrl = '';
    let duration = dto.duration || 5;

    if (dto.mediaType === StoryMediaType.TEXT) {
      if (!dto.caption || !dto.caption.trim()) {
        throw new BadRequestException('Caption is required for text stories.');
      }
      duration = 5;
    } else if (dto.mediaType === StoryMediaType.IMAGE) {
      if (!file) {
        throw new BadRequestException('Image file is required for photo stories.');
      }
      mediaUrl = `${hostBaseUrl}/uploads/stories/${file.filename}`;
      duration = 5;
    } else if (dto.mediaType === StoryMediaType.VIDEO) {
      if (!file) {
        throw new BadRequestException('Video file is required for video stories.');
      }
      if (dto.duration && dto.duration > 30) {
        throw new BadRequestException(
          'Story video duration cannot exceed 30 seconds.',
        );
      }
      mediaUrl = `${hostBaseUrl}/uploads/stories/${file.filename}`;
      duration = dto.duration ? Math.min(Math.max(Math.round(dto.duration), 1), 30) : 15;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const customUserIds: Types.ObjectId[] = (dto.customUserIds || [])
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const story = new this.storyModel({
      user: userObjectId,
      mediaType: dto.mediaType,
      mediaUrl,
      duration,
      caption: dto.caption?.trim() || '',
      backgroundColor: dto.backgroundColor || 'from-pink-500 to-purple-600',
      audience: dto.audience || StoryAudience.ALL,
      customUserIds,
      viewers: [],
      expiresAt,
    });

    await story.save();
    await story.populate('user', 'name email avatarUrl');

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Story published successfully.',
      story: this.formatStory(story, userId),
    };
  }

  async getStoriesFeed(currentUserId: string) {
    const currentObjectId = new Types.ObjectId(currentUserId);

    // 1. Find all accepted friends of current user
    const friendships = await this.friendshipModel
      .find({
        status: FRIENDSHIP_STATUS.ACCEPTED,
        $or: [{ requester: currentObjectId }, { recipient: currentObjectId }],
      })
      .select('requester recipient')
      .exec();

    const blockedUserIds = await this.blocksService.getBlockedUserIds(currentUserId);
    const blockedSet = new Set(blockedUserIds.map((id) => id.toString()));

    const friendObjectIds: Types.ObjectId[] = friendships
      .map((f) => {
        const isRequester = f.requester.toString() === currentUserId;
        return isRequester ? f.recipient : f.requester;
      })
      .filter((id) => !blockedSet.has(id.toString()));

    // Author pool is current user + all friends (excluding blocked users)
    const authorIds = [currentObjectId, ...friendObjectIds];

    // 2. Fetch all active stories from authorIds (TTL: expiresAt > now)
    const rawStories = await this.storyModel
      .find({
        user: { $in: authorIds },
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: 1 })
      .populate('user', 'name email avatarUrl closeFriends')
      .exec();

    // 3. Filter stories based on privacy rules
    const visibleStories = rawStories.filter((story) => {
      const author: any = story.user;
      if (!author) return false;
      const isAuthor = author._id.toString() === currentUserId;

      // Author can always see their own story
      if (isAuthor) return true;

      // Check audience settings
      if (story.audience === StoryAudience.CLOSE_FRIENDS) {
        const closeFriendsList: Types.ObjectId[] = author.closeFriends || [];
        const isCloseFriend = closeFriendsList.some(
          (cfId) => cfId.toString() === currentUserId,
        );
        return isCloseFriend;
      }

      if (story.audience === StoryAudience.HIDE_FROM) {
        const hiddenFrom: Types.ObjectId[] = story.customUserIds || [];
        const isHidden = hiddenFrom.some(
          (hId) => hId.toString() === currentUserId,
        );
        return !isHidden;
      }

      // StoryAudience.ALL
      return true;
    });

    // 4. Group stories by user
    const groupsMap = new Map<
      string,
      {
        user: {
          id: string;
          name: string;
          email: string;
          avatarUrl: string;
        };
        stories: any[];
        hasUnseen: boolean;
        hasCloseFriends: boolean;
        latestStoryAt: Date;
      }
    >();

    for (const story of visibleStories) {
      const author: any = story.user;
      const authorId = author._id.toString();
      const isViewed = (story.viewers || []).some(
        (v: any) => v.toString() === currentUserId,
      );

      if (!groupsMap.has(authorId)) {
        groupsMap.set(authorId, {
          user: {
            id: authorId,
            name: author.name,
            email: author.email,
            avatarUrl: author.avatarUrl || '',
          },
          stories: [],
          hasUnseen: false,
          hasCloseFriends: false,
          latestStoryAt: story.createdAt || new Date(),
        });
      }

      const group = groupsMap.get(authorId)!;
      const formatted = this.formatStory(story, currentUserId);
      group.stories.push(formatted);

      if (!isViewed && authorId !== currentUserId) {
        group.hasUnseen = true;
        if (story.audience === StoryAudience.CLOSE_FRIENDS) {
          group.hasCloseFriends = true;
        }
      }

      if (story.createdAt && story.createdAt > group.latestStoryAt) {
        group.latestStoryAt = story.createdAt;
      }
    }

    // 5. Sort groups: Current user first, unseen stories next, all-seen last
    const userGroups = Array.from(groupsMap.values());
    const currentUserGroup = userGroups.find((g) => g.user.id === currentUserId);
    const otherGroups = userGroups.filter((g) => g.user.id !== currentUserId);

    otherGroups.sort((a, b) => {
      // Unseen before seen
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      // Most recent first
      return (
        new Date(b.latestStoryAt).getTime() - new Date(a.latestStoryAt).getTime()
      );
    });

    const orderedGroups = currentUserGroup
      ? [currentUserGroup, ...otherGroups]
      : otherGroups;

    return {
      error: false,
      statusCode: HttpStatus.OK,
      groups: orderedGroups,
    };
  }

  async markStoryViewed(storyId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new BadRequestException('Invalid story ID.');
    }

    const story = await this.storyModel.findOne({
      _id: new Types.ObjectId(storyId),
      expiresAt: { $gt: new Date() },
    });

    if (!story) {
      throw new NotFoundException('Story not found or expired.');
    }

    // If viewer is not author, record view
    if (story.user.toString() !== currentUserId) {
      await this.storyModel.updateOne(
        { _id: story._id },
        { $addToSet: { viewers: new Types.ObjectId(currentUserId) } },
      );
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Story marked as viewed.',
    };
  }

  async deleteStory(storyId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new BadRequestException('Invalid story ID.');
    }

    const story = await this.storyModel.findById(storyId);
    if (!story) {
      throw new NotFoundException('Story not found.');
    }

    if (story.user.toString() !== currentUserId) {
      throw new ForbiddenException('You can only delete your own stories.');
    }

    // Safely delete file from disk if local upload
    if (story.mediaUrl && story.mediaUrl.includes('/uploads/stories/')) {
      try {
        const filename = story.mediaUrl.split('/uploads/stories/')[1];
        if (filename) {
          const filePath = path.join(process.cwd(), 'uploads', 'stories', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (err) {
        // Log and continue deletion
      }
    }

    await this.storyModel.findByIdAndDelete(story._id);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Story deleted successfully.',
    };
  }

  async reactToStory(storyId: string, currentUserId: string, reaction: string) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new BadRequestException('Invalid story ID.');
    }

    const story = await this.storyModel.findOne({
      _id: new Types.ObjectId(storyId),
      expiresAt: { $gt: new Date() },
    });

    if (!story) {
      throw new NotFoundException('Story not found or expired.');
    }

    if (story.user.toString() === currentUserId) {
      throw new BadRequestException('You cannot react to your own story.');
    }

    if (await this.blocksService.isBlocked(currentUserId, story.user.toString())) {
      throw new ForbiddenException('You cannot interact with this story.');
    }

    const currentObjectId = new Types.ObjectId(currentUserId);

    // 1. Upsert reaction in story.reactions
    if (!story.reactions) {
      story.reactions = [];
    }

    const existingIndex = story.reactions.findIndex(
      (r) => r.user.toString() === currentUserId,
    );

    if (existingIndex >= 0) {
      story.reactions[existingIndex].reaction = reaction;
      story.reactions[existingIndex].createdAt = new Date();
    } else {
      story.reactions.push({
        user: currentObjectId,
        reaction,
        createdAt: new Date(),
      });
    }

    // 2. Mark viewed if not already
    if (!story.viewers.some((v) => v.toString() === currentUserId)) {
      story.viewers.push(currentObjectId);
    }

    await story.save();

    // 3. Dispatch in-chat message to the story author
    try {
      const payload = {
        storyId: story._id.toString(),
        mediaType: story.mediaType,
        mediaUrl: story.mediaUrl || '',
        caption: story.caption || '',
        backgroundColor: story.backgroundColor || '',
        reaction,
      };

      await this.chatService.sendMessage(currentUserId, {
        recipientId: story.user.toString(),
        content: `[STORY_REACTION]:${JSON.stringify(payload)}`,
      });
    } catch (chatErr) {
      // Don't fail the reaction if chat delivery encounters an error
      console.warn('Failed to dispatch story reaction chat message:', chatErr);
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Reaction sent successfully.',
      reaction,
    };
  }

  async replyToStory(storyId: string, currentUserId: string, message: string) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new BadRequestException('Invalid story ID.');
    }

    const story = await this.storyModel.findOne({
      _id: new Types.ObjectId(storyId),
      expiresAt: { $gt: new Date() },
    });

    if (!story) {
      throw new NotFoundException('Story not found or expired.');
    }

    if (story.user.toString() === currentUserId) {
      throw new BadRequestException('You cannot reply to your own story.');
    }

    if (await this.blocksService.isBlocked(currentUserId, story.user.toString())) {
      throw new ForbiddenException('You cannot interact with this story.');
    }

    const currentObjectId = new Types.ObjectId(currentUserId);

    // Mark viewed if not already
    if (!story.viewers.some((v) => v.toString() === currentUserId)) {
      story.viewers.push(currentObjectId);
      await story.save();
    }

    // Dispatch in-chat message to the author with quoted story info
    const payload = {
      storyId: story._id.toString(),
      mediaType: story.mediaType,
      mediaUrl: story.mediaUrl || '',
      caption: story.caption || '',
      backgroundColor: story.backgroundColor || '',
      replyText: message.trim(),
    };

    const chatRes = await this.chatService.sendMessage(currentUserId, {
      recipientId: story.user.toString(),
      content: `[STORY_REPLY]:${JSON.stringify(payload)}`,
    });

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Reply sent successfully.',
      message: chatRes.message,
    };
  }

  async getStoryViewers(
    storyId: string,
    currentUserId: string,
    page = 1,
    limit = 20,
  ) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new BadRequestException('Invalid story ID.');
    }

    const story = await this.storyModel
      .findById(storyId)
      .populate('reactions.user', 'name email avatarUrl')
      .exec();

    if (!story) {
      throw new NotFoundException('Story not found.');
    }

    if (story.user.toString() !== currentUserId) {
      throw new ForbiddenException('Only the author can view story viewers.');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const allViewerIds = (story.viewers || []) as Types.ObjectId[];
    const totalViewers = allViewerIds.length;
    const totalPages = Math.ceil(totalViewers / safeLimit) || 1;
    const skip = (safePage - 1) * safeLimit;

    // Slice viewers for the requested page
    const slicedViewerIds = allViewerIds.slice(skip, skip + safeLimit);

    // Fetch user details for only the sliced viewers
    const populatedUsers = await this.userModel
      .find({ _id: { $in: slicedViewerIds } })
      .select('name email avatarUrl')
      .lean();

    const usersMap = new Map<string, any>();
    for (const u of populatedUsers) {
      usersMap.set(u._id.toString(), u);
    }

    const reactionsMap = new Map<string, string>();
    const reactionsSummary: Record<string, number> = {};

    for (const r of story.reactions || []) {
      const rUser: any = r.user;
      const rUserId = rUser?._id ? rUser._id.toString() : r.user?.toString();
      if (rUserId && r.reaction) {
        reactionsMap.set(rUserId, r.reaction);
        reactionsSummary[r.reaction] = (reactionsSummary[r.reaction] || 0) + 1;
      }
    }

    // Preserve the original order of viewers from the story
    const viewers = slicedViewerIds
      .map((id) => {
        const idStr = id.toString();
        const user = usersMap.get(idStr);
        if (!user) return null;
        return {
          id: idStr,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl || '',
          reaction: reactionsMap.get(idStr) || null,
        };
      })
      .filter(Boolean);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      totalViewers,
      count: totalViewers,
      page: safePage,
      limit: safeLimit,
      totalPages,
      hasMore: safePage < totalPages,
      reactionsSummary,
      viewers,
    };
  }

  async getCloseFriends(currentUserId: string) {
    const user = await this.userModel
      .findById(currentUserId)
      .populate('closeFriends', 'name email avatarUrl bio')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const closeFriends = ((user.closeFriends as any[]) || []).map((cf) => ({
      id: cf._id.toString(),
      name: cf.name,
      email: cf.email,
      avatarUrl: cf.avatarUrl || '',
      bio: cf.bio || '',
    }));

    return {
      error: false,
      statusCode: HttpStatus.OK,
      closeFriends,
    };
  }

  async updateCloseFriends(currentUserId: string, closeFriendIds: string[]) {
    const validObjectIds = closeFriendIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    await this.userModel.findByIdAndUpdate(currentUserId, {
      $set: { closeFriends: validObjectIds },
    });

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Close friends updated successfully.',
    };
  }

  private formatStory(story: any, currentUserId: string) {
    const author = story.user;
    const authorId = author?._id ? author._id.toString() : story.user?.toString();
    const viewers = story.viewers || [];
    const isViewed = viewers.some(
      (v: any) => (v._id ? v._id.toString() : v.toString()) === currentUserId,
    );

    const userReaction = (story.reactions || []).find(
      (r: any) =>
        (r.user?._id ? r.user._id.toString() : r.user?.toString()) ===
        currentUserId,
    );

    return {
      id: story._id.toString(),
      userId: authorId,
      user: author?._id
        ? {
            id: author._id.toString(),
            name: author.name,
            email: author.email,
            avatarUrl: author.avatarUrl || '',
          }
        : undefined,
      mediaType: story.mediaType,
      mediaUrl: story.mediaUrl || '',
      duration: story.duration || 5,
      caption: story.caption || '',
      backgroundColor: story.backgroundColor || 'from-pink-500 to-purple-600',
      audience: story.audience || StoryAudience.ALL,
      viewersCount: viewers.length,
      isViewed,
      myReaction: userReaction?.reaction || null,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
    };
  }
}
