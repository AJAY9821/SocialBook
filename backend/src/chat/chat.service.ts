import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from 'models/message';
import { FRIENDSHIP_STATUS, Friendship } from 'models/friendship';
import { User } from 'models/user';
import { BlocksService } from 'src/blocks/blocks.service';
import { SendAudioMessageDto, SendMessageDto } from './dto';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<Friendship>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    private readonly blocksService: BlocksService,
  ) {}

  /**
   * Send a private 1-on-1 message to an accepted friend
   */
  async sendMessage(senderId: string, dto: SendMessageDto) {
    if (!Types.ObjectId.isValid(dto.recipientId)) {
      throw new BadRequestException('Invalid recipient ID.');
    }

    if (senderId === dto.recipientId) {
      throw new BadRequestException('You cannot message yourself.');
    }

    const senderObjectId = new Types.ObjectId(senderId);
    const recipientObjectId = new Types.ObjectId(dto.recipientId);

    // 1. Verify recipient exists and is not deleted
    const recipient = await this.userModel.findOne({
      _id: recipientObjectId,
      isDeleted: false,
    });
    if (!recipient) {
      throw new NotFoundException('Recipient user not found.');
    }

    // 1.5. Check block status
    if (await this.blocksService.isBlocked(senderId, dto.recipientId)) {
      throw new ForbiddenException('You cannot message this user.');
    }

    // 2. Strict Privacy Guard: Must be accepted friends!
    const friendship = await this.friendshipModel.findOne({
      status: FRIENDSHIP_STATUS.ACCEPTED,
      $or: [
        { requester: senderObjectId, recipient: recipientObjectId },
        { requester: recipientObjectId, recipient: senderObjectId },
      ],
    });

    if (!friendship) {
      throw new ForbiddenException(
        'You can only send messages to users who are your accepted friends.',
      );
    }

    // 3. Save message
    const message = await this.messageModel.create({
      sender: senderObjectId,
      recipient: recipientObjectId,
      content: dto.content,
      isRead: false,
    });

    const populated = await message.populate([
      { path: 'sender', select: 'name email avatarUrl' },
      { path: 'recipient', select: 'name email avatarUrl' },
    ]);

    const formatted = this.formatMessage(populated, senderId);

    // Push real-time event directly to recipient and sender sockets
    try {
      this.chatGateway.emitNewMessage(dto.recipientId, senderId, formatted);
    } catch {
      // Non-blocking if socket emit fails
    }

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Message sent successfully.',
      message: formatted,
    };
  }

  /**
   * Send a voice audio note to an accepted friend
   */
  async sendAudioMessage(
    senderId: string,
    dto: SendAudioMessageDto,
    file: Express.Multer.File,
    hostBaseUrl: string,
  ) {
    if (!Types.ObjectId.isValid(dto.recipientId)) {
      throw new BadRequestException('Invalid recipient ID.');
    }

    if (senderId === dto.recipientId) {
      throw new BadRequestException('You cannot message yourself.');
    }

    const senderObjectId = new Types.ObjectId(senderId);
    const recipientObjectId = new Types.ObjectId(dto.recipientId);

    // 1. Verify recipient exists and is not deleted
    const recipient = await this.userModel.findOne({
      _id: recipientObjectId,
      isDeleted: false,
    });
    if (!recipient) {
      throw new NotFoundException('Recipient user not found.');
    }

    // 1.5. Check block status
    if (await this.blocksService.isBlocked(senderId, dto.recipientId)) {
      throw new ForbiddenException('You cannot message this user.');
    }

    // 2. Strict Privacy Guard: Must be accepted friends
    const friendship = await this.friendshipModel.findOne({
      status: FRIENDSHIP_STATUS.ACCEPTED,
      $or: [
        { requester: senderObjectId, recipient: recipientObjectId },
        { requester: recipientObjectId, recipient: senderObjectId },
      ],
    });

    if (!friendship) {
      throw new ForbiddenException(
        'You can only send messages to users who are your accepted friends.',
      );
    }

    // 3. Construct public audio URL
    const audioUrl = `${hostBaseUrl}/uploads/audio/${file.filename}`;

    // Format duration text for fallback content preview (e.g. "🎤 Voice message (0:14)")
    const totalSecs = Math.round(Number(dto.duration) || 0);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const fallbackContent = `🎤 Voice message (${durationFormatted})`;

    // Parse waveform if provided
    let audioWaveform: number[] | undefined;
    if (dto.waveform) {
      try {
        const parsed = JSON.parse(dto.waveform);
        if (Array.isArray(parsed)) {
          audioWaveform = parsed.map((n) => Number(n)).filter((n) => !isNaN(n));
        }
      } catch {
        // Fallback: waveform is optional
      }
    }

    // 4. Save message
    const message = await this.messageModel.create({
      sender: senderObjectId,
      recipient: recipientObjectId,
      content: fallbackContent,
      messageType: 'audio',
      audioUrl,
      audioDuration: Number(dto.duration),
      audioWaveform,
      isRead: false,
    });

    const populated = await message.populate([
      { path: 'sender', select: 'name email avatarUrl' },
      { path: 'recipient', select: 'name email avatarUrl' },
    ]);

    const formatted = this.formatMessage(populated, senderId);

    // 5. Emit real-time WebSocket event directly to recipient and sender
    try {
      this.chatGateway.emitNewMessage(dto.recipientId, senderId, formatted);
    } catch {
      // Non-blocking if socket emit fails
    }

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Audio message sent successfully.',
      message: formatted,
    };
  }

  /**
   * Get all conversations (list of friends with latest message preview & unread count)
   */
  async getConversations(userId: string) {
    const currentObjectId = new Types.ObjectId(userId);

    // 1. Find all accepted friendships
    const friendships = await this.friendshipModel
      .find({
        status: FRIENDSHIP_STATUS.ACCEPTED,
        $or: [{ requester: currentObjectId }, { recipient: currentObjectId }],
      })
      .populate('requester', 'name email avatarUrl isDeleted')
      .populate('recipient', 'name email avatarUrl isDeleted')
      .lean();

    // 2. Extract friend profiles
    const friendProfiles: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
    }> = [];

    for (const f of friendships) {
      const requester: any = f.requester;
      const recipient: any = f.recipient;

      const isCurrentRequester = requester._id.toString() === userId;
      const friend = isCurrentRequester ? recipient : requester;

      if (friend && !friend.isDeleted) {
        friendProfiles.push({
          id: friend._id.toString(),
          name: friend.name,
          email: friend.email,
          avatarUrl: friend.avatarUrl || '',
        });
      }
    }

    // 3. For each friend, fetch the latest message and unread count in parallel
    const conversationPromises = friendProfiles.map(async (friend) => {
      const friendObjectId = new Types.ObjectId(friend.id);

      const [latestMessage, unreadCount] = await Promise.all([
        this.messageModel
          .findOne({
            $or: [
              { sender: currentObjectId, recipient: friendObjectId },
              { sender: friendObjectId, recipient: currentObjectId },
            ],
          })
          .sort({ createdAt: -1 })
          .lean(),
        this.messageModel.countDocuments({
          sender: friendObjectId,
          recipient: currentObjectId,
          isRead: false,
        }),
      ]);

      return {
        friend,
        latestMessage: latestMessage
          ? {
              id: latestMessage._id.toString(),
              content: latestMessage.content,
              messageType: (latestMessage as any).messageType || 'text',
              audioUrl: (latestMessage as any).audioUrl,
              audioDuration: (latestMessage as any).audioDuration,
              senderId: latestMessage.sender.toString(),
              isMe: latestMessage.sender.toString() === userId,
              isRead: latestMessage.isRead,
              createdAt: latestMessage.createdAt,
            }
          : null,
        unreadCount,
        lastActivityAt: latestMessage?.createdAt || new Date(0),
      };
    });

    const conversations = await Promise.all(conversationPromises);

    // Sort: Most recent activity at the top
    conversations.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );

    return {
      error: false,
      statusCode: HttpStatus.OK,
      conversations,
    };
  }

  /**
   * Get chat message history with a specific friend (paginated)
   */
  async getChatHistory(
    userId: string,
    friendId: string,
    page = 1,
    limit = 50,
  ) {
    if (!Types.ObjectId.isValid(friendId)) {
      throw new BadRequestException('Invalid friend ID.');
    }

    const currentObjectId = new Types.ObjectId(userId);
    const friendObjectId = new Types.ObjectId(friendId);

    // 1. Verify friend exists
    const friend = await this.userModel.findOne({
      _id: friendObjectId,
      isDeleted: false,
    });
    if (!friend) {
      throw new NotFoundException('Friend user not found.');
    }

    // 2. Verify friendship or block status
    const blockStatus = await this.blocksService.getBlockStatus(userId, friendId);

    const friendship = await this.friendshipModel.findOne({
      status: FRIENDSHIP_STATUS.ACCEPTED,
      $or: [
        { requester: currentObjectId, recipient: friendObjectId },
        { requester: friendObjectId, recipient: currentObjectId },
      ],
    });

    if (!friendship && !blockStatus.isBlocked) {
      throw new ForbiddenException(
        'You can only view chat history with users who are your accepted friends.',
      );
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (safePage - 1) * safeLimit;

    const filter = {
      $or: [
        { sender: currentObjectId, recipient: friendObjectId },
        { sender: friendObjectId, recipient: currentObjectId },
      ],
    };

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('sender', 'name email avatarUrl')
        .populate('recipient', 'name email avatarUrl')
        .exec(),
      this.messageModel.countDocuments(filter),
    ]);

    // Automatically mark all incoming unread messages from this friend as read
    const readResult = await this.messageModel.updateMany(
      {
        sender: friendObjectId,
        recipient: currentObjectId,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      },
    );

    if (readResult.modifiedCount > 0) {
      try {
        this.chatGateway.emitMessagesRead(friendId, userId);
      } catch {
        // Non-blocking socket emit
      }
    }

    // Reverse to chronological order (oldest to newest) for chat display
    const chronologicalMessages = messages
      .reverse()
      .map((msg) => this.formatMessage(msg, userId));

    return {
      error: false,
      statusCode: HttpStatus.OK,
      friend: {
        id: friend._id.toString(),
        name: friend.name,
        email: friend.email,
        avatarUrl: friend.avatarUrl || '',
      },
      isBlockedByMe: blockStatus.isBlockedByMe,
      isBlockedByOther: blockStatus.isBlockedByOther,
      isBlocked: blockStatus.isBlocked,
      messages: chronologicalMessages,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Mark all unread messages from a friend as read
   */
  async markAsRead(userId: string, friendId: string) {
    if (!Types.ObjectId.isValid(friendId)) {
      throw new BadRequestException('Invalid friend ID.');
    }

    const readResult = await this.messageModel.updateMany(
      {
        sender: new Types.ObjectId(friendId),
        recipient: new Types.ObjectId(userId),
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      },
    );

    if (readResult.modifiedCount > 0) {
      try {
        this.chatGateway.emitMessagesRead(friendId, userId);
      } catch {
        // Non-blocking socket emit
      }
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Messages marked as read.',
    };
  }

  /**
   * Get total count of unread messages for Navbar badge
   */
  async getUnreadCount(userId: string) {
    const totalUnread = await this.messageModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
    });

    return {
      error: false,
      statusCode: HttpStatus.OK,
      unreadCount: totalUnread,
    };
  }

  private formatMessage(msg: Message, currentUserId: string) {
    const obj = msg.toObject();
    const senderObj = obj.sender as any;
    const recipientObj = obj.recipient as any;

    return {
      id: obj._id.toString(),
      sender: {
        id: senderObj._id ? senderObj._id.toString() : senderObj.toString(),
        name: senderObj.name || '',
        email: senderObj.email || '',
        avatarUrl: senderObj.avatarUrl || '',
      },
      recipient: {
        id: recipientObj._id
          ? recipientObj._id.toString()
          : recipientObj.toString(),
        name: recipientObj.name || '',
        email: recipientObj.email || '',
        avatarUrl: recipientObj.avatarUrl || '',
      },
      content: obj.content,
      messageType: obj.messageType || 'text',
      audioUrl: obj.audioUrl,
      audioDuration: obj.audioDuration,
      audioWaveform: obj.audioWaveform,
      isRead: obj.isRead,
      readAt: obj.readAt,
      isMe:
        (senderObj._id ? senderObj._id.toString() : senderObj.toString()) ===
        currentUserId,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
