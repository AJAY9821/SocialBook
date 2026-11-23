import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FRIENDSHIP_STATUS, Friendship } from 'models/friendship';
import { User } from 'models/user';
import { BlocksService } from 'src/blocks/blocks.service';

@Injectable()
export class FriendsService {
  constructor(
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<Friendship>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly blocksService: BlocksService,
  ) {}

  async sendFriendRequest(requesterId: string, recipientId: string) {
    if (!Types.ObjectId.isValid(recipientId)) {
      throw new BadRequestException('Invalid recipient user ID.');
    }

    if (requesterId === recipientId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself.',
      );
    }

    const recipient = await this.userModel.findOne({
      _id: recipientId,
      isDeleted: false,
    });

    if (!recipient) {
      throw new NotFoundException('Recipient user not found.');
    }

    if (await this.blocksService.isBlocked(requesterId, recipientId)) {
      throw new BadRequestException(
        'You cannot send a friend request to this user.',
      );
    }

    const requesterObjectId = new Types.ObjectId(requesterId);
    const recipientObjectId = new Types.ObjectId(recipientId);

    const existing = await this.friendshipModel.findOne({
      $or: [
        { requester: requesterObjectId, recipient: recipientObjectId },
        { requester: recipientObjectId, recipient: requesterObjectId },
      ],
    });

    if (existing) {
      if (existing.status === FRIENDSHIP_STATUS.ACCEPTED) {
        throw new ConflictException('You are already friends with this user.');
      }

      if (existing.status === FRIENDSHIP_STATUS.PENDING) {
        if (existing.requester.toString() === requesterId) {
          throw new ConflictException('Friend request already sent.');
        }
        throw new ConflictException(
          'This user has already sent you a friend request. Please accept or reject it.',
        );
      }

      // Re-open previously rejected request in the new requester's direction
      existing.requester = requesterObjectId;
      existing.recipient = recipientObjectId;
      existing.status = FRIENDSHIP_STATUS.PENDING;
      await existing.save();
      await existing.populate([
        { path: 'requester', select: 'name email avatarUrl' },
        { path: 'recipient', select: 'name email avatarUrl' },
      ]);

      return {
        error: false,
        statusCode: HttpStatus.CREATED,
        msg: 'Friend request sent successfully.',
        request: this.formatFriendship(existing),
      };
    }

    const friendship = await this.friendshipModel.create({
      requester: requesterObjectId,
      recipient: recipientObjectId,
      status: FRIENDSHIP_STATUS.PENDING,
    });

    await friendship.populate([
      { path: 'requester', select: 'name email avatarUrl' },
      { path: 'recipient', select: 'name email avatarUrl' },
    ]);

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Friend request sent successfully.',
      request: this.formatFriendship(friendship),
    };
  }

  async acceptFriendRequest(requestId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(requestId)) {
      throw new BadRequestException('Invalid friend request ID.');
    }

    const friendship = await this.friendshipModel.findById(requestId);
    if (!friendship) {
      throw new NotFoundException('Friend request not found.');
    }

    if (friendship.recipient.toString() !== currentUserId) {
      throw new ForbiddenException(
        'Only the recipient can accept this friend request.',
      );
    }

    if (friendship.status !== FRIENDSHIP_STATUS.PENDING) {
      throw new BadRequestException(
        `This friend request has already been ${friendship.status}.`,
      );
    }

    friendship.status = FRIENDSHIP_STATUS.ACCEPTED;
    await friendship.save();
    await friendship.populate([
      { path: 'requester', select: 'name email avatarUrl' },
      { path: 'recipient', select: 'name email avatarUrl' },
    ]);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Friend request accepted.',
      friendship: this.formatFriendship(friendship),
    };
  }

  async rejectFriendRequest(requestId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(requestId)) {
      throw new BadRequestException('Invalid friend request ID.');
    }

    const friendship = await this.friendshipModel.findById(requestId);
    if (!friendship) {
      throw new NotFoundException('Friend request not found.');
    }

    if (friendship.recipient.toString() !== currentUserId) {
      throw new ForbiddenException(
        'Only the recipient can reject this friend request.',
      );
    }

    if (friendship.status !== FRIENDSHIP_STATUS.PENDING) {
      throw new BadRequestException(
        `This friend request has already been ${friendship.status}.`,
      );
    }

    friendship.status = FRIENDSHIP_STATUS.REJECTED;
    await friendship.save();

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Friend request rejected.',
    };
  }

  async cancelFriendRequest(requestId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(requestId)) {
      throw new BadRequestException('Invalid friend request ID.');
    }

    const friendship = await this.friendshipModel.findById(requestId);
    if (!friendship) {
      throw new NotFoundException('Friend request not found.');
    }

    if (friendship.requester.toString() !== currentUserId) {
      throw new ForbiddenException(
        'Only the sender can cancel this friend request.',
      );
    }

    if (friendship.status !== FRIENDSHIP_STATUS.PENDING) {
      throw new BadRequestException(
        'Only pending friend requests can be cancelled.',
      );
    }

    await this.friendshipModel.findByIdAndDelete(friendship._id);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Friend request cancelled.',
    };
  }

  async getIncomingRequests(currentUserId: string) {
    const requests = await this.friendshipModel
      .find({
        recipient: new Types.ObjectId(currentUserId),
        status: FRIENDSHIP_STATUS.PENDING,
      })
      .sort({ createdAt: -1 })
      .populate('requester', 'name email avatarUrl bio')
      .exec();

    return {
      error: false,
      statusCode: HttpStatus.OK,
      count: requests.length,
      requests: requests.map((req) => {
        const obj = req.toObject();
        return {
          id: obj._id.toString(),
          requester: obj.requester,
          status: obj.status,
          createdAt: obj.createdAt,
        };
      }),
    };
  }

  async getOutgoingRequests(currentUserId: string) {
    const requests = await this.friendshipModel
      .find({
        requester: new Types.ObjectId(currentUserId),
        status: FRIENDSHIP_STATUS.PENDING,
      })
      .sort({ createdAt: -1 })
      .populate('recipient', 'name email avatarUrl bio')
      .exec();

    return {
      error: false,
      statusCode: HttpStatus.OK,
      count: requests.length,
      requests: requests.map((req) => {
        const obj = req.toObject();
        return {
          id: obj._id.toString(),
          recipient: obj.recipient,
          status: obj.status,
          createdAt: obj.createdAt,
        };
      }),
    };
  }

  async getFriendsList(currentUserId: string) {
    const currentObjectId = new Types.ObjectId(currentUserId);
    const blockedUserIds = await this.blocksService.getBlockedUserIds(currentUserId);
    const blockedSet = new Set(blockedUserIds.map((id) => id.toString()));

    const friendships = await this.friendshipModel
      .find({
        status: FRIENDSHIP_STATUS.ACCEPTED,
        $or: [{ requester: currentObjectId }, { recipient: currentObjectId }],
      })
      .sort({ updatedAt: -1 })
      .populate('requester', 'name email avatarUrl bio location')
      .populate('recipient', 'name email avatarUrl bio location')
      .exec();

    const friends = friendships
      .filter((friendship) => {
        const obj: any = friendship.toObject();
        const isRequester = obj.requester._id.toString() === currentUserId;
        const friend = isRequester ? obj.recipient : obj.requester;
        return !blockedSet.has(friend._id.toString());
      })
      .map((friendship) => {
      const obj: any = friendship.toObject();
      const isRequester = obj.requester._id.toString() === currentUserId;
      const friend = isRequester ? obj.recipient : obj.requester;

      return {
        friendshipId: obj._id.toString(),
        friendsSince: obj.updatedAt,
        friend: {
          id: friend._id.toString(),
          name: friend.name,
          email: friend.email,
          avatarUrl: friend.avatarUrl || '',
          bio: friend.bio || '',
          location: friend.location || '',
        },
      };
    });

    return {
      error: false,
      statusCode: HttpStatus.OK,
      count: friends.length,
      friends,
    };
  }

  async unfriend(friendId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(friendId)) {
      throw new BadRequestException('Invalid friend user ID.');
    }

    const currentObjectId = new Types.ObjectId(currentUserId);
    const friendObjectId = new Types.ObjectId(friendId);

    const deleted = await this.friendshipModel.findOneAndDelete({
      status: FRIENDSHIP_STATUS.ACCEPTED,
      $or: [
        { requester: currentObjectId, recipient: friendObjectId },
        { requester: friendObjectId, recipient: currentObjectId },
      ],
    });

    if (!deleted) {
      throw new NotFoundException('Friendship not found.');
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Friend removed successfully.',
    };
  }

  private formatFriendship(friendship: Friendship) {
    const obj = friendship.toObject();
    return {
      id: obj._id.toString(),
      requester: obj.requester,
      recipient: obj.recipient,
      status: obj.status,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
