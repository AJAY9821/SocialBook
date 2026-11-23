import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Block } from 'models/block';
import { User } from 'models/user';
import { Friendship } from 'models/friendship';

@Injectable()
export class BlocksService {
  constructor(
    @InjectModel(Block.name) private readonly blockModel: Model<Block>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<Friendship>,
  ) {}

  async blockUser(blockerId: string, blockedId: string) {
    if (!Types.ObjectId.isValid(blockerId) || !Types.ObjectId.isValid(blockedId)) {
      throw new BadRequestException('Invalid user ID.');
    }

    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself.');
    }

    const blockerObjectId = new Types.ObjectId(blockerId);
    const blockedObjectId = new Types.ObjectId(blockedId);

    // 1. Verify target user exists and is not deleted
    const targetUser = await this.userModel.findOne({
      _id: blockedObjectId,
      isDeleted: false,
    });
    if (!targetUser) {
      throw new NotFoundException('User not found.');
    }

    // 2. Create or upsert the Block relation
    await this.blockModel.findOneAndUpdate(
      { blocker: blockerObjectId, blocked: blockedObjectId },
      { blocker: blockerObjectId, blocked: blockedObjectId },
      { upsert: true, new: true },
    );

    // 3. Cascade Cleanup: Immediately remove any friendship (pending or accepted)
    await this.friendshipModel.deleteMany({
      $or: [
        { requester: blockerObjectId, recipient: blockedObjectId },
        { requester: blockedObjectId, recipient: blockerObjectId },
      ],
    });

    // 4. Cascade Cleanup: Remove from close friends mutually
    await Promise.all([
      this.userModel.updateOne(
        { _id: blockerObjectId },
        { $pull: { closeFriends: blockedObjectId } },
      ),
      this.userModel.updateOne(
        { _id: blockedObjectId },
        { $pull: { closeFriends: blockerObjectId } },
      ),
    ]);

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'User blocked successfully.',
    };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    if (!Types.ObjectId.isValid(blockerId) || !Types.ObjectId.isValid(blockedId)) {
      throw new BadRequestException('Invalid user ID.');
    }

    const blockerObjectId = new Types.ObjectId(blockerId);
    const blockedObjectId = new Types.ObjectId(blockedId);

    const result = await this.blockModel.deleteOne({
      blocker: blockerObjectId,
      blocked: blockedObjectId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Block record not found.');
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'User unblocked successfully.',
    };
  }

  async getBlockedUsers(blockerId: string) {
    if (!Types.ObjectId.isValid(blockerId)) {
      throw new BadRequestException('Invalid user ID.');
    }

    const blockerObjectId = new Types.ObjectId(blockerId);

    const blocks = await this.blockModel
      .find({ blocker: blockerObjectId })
      .sort({ createdAt: -1 })
      .populate('blocked', 'name email avatarUrl bio location')
      .exec();

    const blockedUsers = blocks
      .filter((b) => b.blocked)
      .map((b) => {
        const u = b.blocked as any;
        return {
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl || '',
          bio: u.bio || '',
          location: u.location || '',
          blockedAt: b['createdAt'] || new Date(),
        };
      });

    return {
      error: false,
      statusCode: HttpStatus.OK,
      count: blockedUsers.length,
      blockedUsers,
    };
  }

  async getBlockStatus(userIdA: string, userIdB: string) {
    if (!Types.ObjectId.isValid(userIdA) || !Types.ObjectId.isValid(userIdB)) {
      return {
        error: false,
        statusCode: HttpStatus.OK,
        isBlockedByMe: false,
        isBlockedByOther: false,
        isBlocked: false,
      };
    }

    const objA = new Types.ObjectId(userIdA);
    const objB = new Types.ObjectId(userIdB);

    const [blockedByMe, blockedByOther] = await Promise.all([
      this.blockModel.exists({ blocker: objA, blocked: objB }),
      this.blockModel.exists({ blocker: objB, blocked: objA }),
    ]);

    const isByMe = !!blockedByMe;
    const isByOther = !!blockedByOther;

    return {
      error: false,
      statusCode: HttpStatus.OK,
      isBlockedByMe: isByMe,
      isBlockedByOther: isByOther,
      isBlocked: isByMe || isByOther,
    };
  }

  async isBlocked(userA: string, userB: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userA) || !Types.ObjectId.isValid(userB)) {
      return false;
    }

    const count = await this.blockModel.countDocuments({
      $or: [
        { blocker: new Types.ObjectId(userA), blocked: new Types.ObjectId(userB) },
        { blocker: new Types.ObjectId(userB), blocked: new Types.ObjectId(userA) },
      ],
    });

    return count > 0;
  }

  async getBlockedUserIds(userId: string): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }

    const userObjectId = new Types.ObjectId(userId);
    const blocks = await this.blockModel
      .find({
        $or: [{ blocker: userObjectId }, { blocked: userObjectId }],
      })
      .select('blocker blocked')
      .lean();

    const idsSet = new Set<string>();
    for (const b of blocks) {
      if (b.blocker.toString() === userId) {
        idsSet.add(b.blocked.toString());
      }
      if (b.blocked.toString() === userId) {
        idsSet.add(b.blocker.toString());
      }
    }

    return Array.from(idsSet).map((id) => new Types.ObjectId(id));
  }
}
