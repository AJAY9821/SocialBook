import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { User } from 'models/user';
import { Friendship, FRIENDSHIP_STATUS } from 'models/friendship';
import { CustomLogger } from 'src/common/services';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /**
   * Tracks active sockets per user: userId -> Set of socket IDs
   * Ensures that closing 1 tab does not mark a user offline if they have other tabs open.
   */
  private activeUsers = new Map<string, Set<string>>();

  /**
   * Fast reverse lookup: socketId -> userId
   */
  private socketUserMap = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<Friendship>,
    private readonly logger: CustomLogger,
  ) {
    this.logger.setContext('ChatGateway');
  }

  afterInit() {
    this.logger.log('Chat WebSocket Gateway initialized.');
  }

  /**
   * Authenticate connecting socket using AccessToken from handshake
   */
  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization;

      const token = typeof rawToken === 'string'
        ? rawToken.replace(/^Bearer\s+/i, '').trim()
        : null;

      if (!token) {
        this.logger.debug(`Socket connection rejected: No token provided (${client.id})`);
        client.disconnect(true);
        return;
      }

      // Fast in-memory cryptographic verification in server RAM
      let payload: any;
      try {
        payload = this.jwtService.verify(token, {
          secret: process.env.JWT_ACCESS_TOKEN_SECRET as string,
        });
      } catch {
        this.logger.debug(`Socket connection rejected: Invalid or expired token (${client.id})`);
        client.disconnect(true);
        return;
      }

      const rawUserId = payload?.user?.id || payload?.sub;
      if (!rawUserId) {
        this.logger.debug(`Socket connection rejected: Malformed token payload (${client.id})`);
        client.disconnect(true);
        return;
      }

      // Verify user exists and is active
      const user = await this.userModel.findById(rawUserId);
      if (!user || user.isDeleted) {
        this.logger.debug(`Socket connection rejected: User not found or deleted (${client.id})`);
        client.disconnect(true);
        return;
      }

      const userId = user._id.toString();
      client.data.userId = userId;
      client.data.user = user;

      // Register socket in active tracking
      this.socketUserMap.set(client.id, userId);

      let userSockets = this.activeUsers.get(userId);
      const isFirstSocket = !userSockets || userSockets.size === 0;

      if (!userSockets) {
        userSockets = new Set<string>();
        this.activeUsers.set(userId, userSockets);
      }
      userSockets.add(client.id);

      // Join client to their private user room
      client.join(`user:${userId}`);

      // Retrieve user's accepted friends
      const friendIds = await this.getAcceptedFriendIds(userId);

      // If user just came online (first tab/socket)
      if (isFirstSocket) {
        this.logger.debug(`User came online: ${user.name} (${userId})`);

        // Broadcast presence:user_online to online friends
        for (const friendId of friendIds) {
          if (this.isUserOnline(friendId)) {
            this.server.to(`user:${friendId}`).emit('presence:user_online', {
              userId,
            });
          }
        }
      }

      // Send the newly connected user the initial list of friends who are currently online
      const onlineFriendIds = friendIds.filter((fId) => this.isUserOnline(fId));
      client.emit('presence:init', {
        onlineUserIds: onlineFriendIds,
      });
    } catch (err) {
      this.logger.warn(`Error during socket handshake (${client.id}): ${err}`);
      client.disconnect(true);
    }
  }

  /**
   * Handle socket disconnection and broadcast offline presence when all tabs close
   */
  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data?.userId || this.socketUserMap.get(client.id);
      this.socketUserMap.delete(client.id);

      if (!userId || !this.activeUsers.has(userId)) return;

      const userSockets = this.activeUsers.get(userId)!;
      userSockets.delete(client.id);

      // If this was the user's last socket, they have gone offline
      if (userSockets.size === 0) {
        this.activeUsers.delete(userId);
        this.logger.debug(`User went offline: ${userId}`);

        const friendIds = await this.getAcceptedFriendIds(userId);
        const lastSeen = new Date();

        // Broadcast presence:user_offline to online friends
        for (const friendId of friendIds) {
          if (this.isUserOnline(friendId)) {
            this.server.to(`user:${friendId}`).emit('presence:user_offline', {
              userId,
              lastSeen,
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Error during socket disconnect (${client.id}): ${err}`);
    }
  }

  /**
   * Real-Time Typing Indicator
   * Client emits: chat:typing { recipientId: string, isTyping: boolean }
   * Server relays to recipient: chat:user_typing { senderId: string, isTyping: boolean }
   */
  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { recipientId: string; isTyping: boolean },
  ) {
    const senderId = client.data?.userId;
    if (!senderId || !data?.recipientId) return;

    this.server.to(`user:${data.recipientId}`).emit('chat:user_typing', {
      senderId,
      isTyping: Boolean(data.isTyping),
    });
  }

  /**
   * Push newly sent message immediately to recipient and sender rooms
   */
  emitNewMessage(recipientId: string, senderId: string, message: any) {
    // Deliver instantly to recipient's room with isMe = false
    this.server.to(`user:${recipientId}`).emit('chat:new_message', {
      message: { ...message, isMe: false },
    });
    // Also deliver to sender's other tabs with isMe = true
    this.server.to(`user:${senderId}`).emit('chat:new_message', {
      message: { ...message, isMe: true },
    });
  }

  /**
   * Push real-time read receipt to the sender when their messages are read
   */
  emitMessagesRead(senderId: string, readByUserId: string) {
    this.server.to(`user:${senderId}`).emit('chat:messages_read', {
      readByUserId,
      readAt: new Date().toISOString(),
    });
  }

  /**
   * Check if a user is currently online (has at least 1 active socket)
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.activeUsers.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  /**
   * Helper to retrieve list of accepted friend IDs for a given user
   */
  private async getAcceptedFriendIds(userId: string): Promise<string[]> {
    try {
      const userObjId = new Types.ObjectId(userId);
      const friendships = await this.friendshipModel
        .find({
          status: FRIENDSHIP_STATUS.ACCEPTED,
          $or: [{ requester: userObjId }, { recipient: userObjId }],
        })
        .select('requester recipient')
        .lean();

      return friendships.map((f) =>
        f.requester.toString() === userId
          ? f.recipient.toString()
          : f.requester.toString(),
      );
    } catch {
      return [];
    }
  }
}
