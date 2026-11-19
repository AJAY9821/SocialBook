import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GetUserProfileResDTO,
  UpdateProfileReqDto,
  UserProfileDto,
} from './user-dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'models/user';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async getUserProfile(user: User): Promise<GetUserProfileResDTO> {
    const userResp = UserProfileDto.transform(user);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      user: userResp,
    };
  }

  async updateProfile(userId: string, updateData: UpdateProfileReqDto) {
    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      {
        $set: {
          ...updateData,
          isAccountCompleted: true,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found.');
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Profile updated successfully.',
      user: UserProfileDto.transform(updatedUser),
    };
  }

  async updateProfileImage(
    userId: string,
    fields: { avatarUrl?: string; coverUrl?: string },
  ) {
    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { $set: fields },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found.');
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Profile photo updated successfully.',
      user: UserProfileDto.transform(updatedUser),
    };
  }

  async searchUsers(query: string, currentUserId: string) {
    const trimmedQuery = (query || '').trim();

    if (!trimmedQuery) {
      return {
        error: false,
        statusCode: HttpStatus.OK,
        users: [],
      };
    }

    // Escape special regex characters so user input cannot break regex matching
    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    const users = await this.userModel
      .find({
        _id: { $ne: currentUserId },
        isDeleted: false,
        $or: [{ name: regex }, { email: regex }],
      })
      .limit(20)
      .exec();

    return {
      error: false,
      statusCode: HttpStatus.OK,
      users: users.map((u) => UserProfileDto.transform(u)),
    };
  }

  async getUserById(userId: string): Promise<GetUserProfileResDTO> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID.');
    }

    const user = await this.userModel.findOne({
      _id: userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      user: UserProfileDto.transform(user),
    };
  }
}
