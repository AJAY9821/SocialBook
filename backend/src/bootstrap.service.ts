import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { User } from 'models/user';
import { Connection, Model } from 'mongoose';
import { CustomLogger } from './common/services';
import { ErrorResponse } from './utils/responses';
import { ROLE_VALUES } from 'models/user/user.schema';

interface AdminData {
  EMAIL: string;
  NAME: string;
  PASSWORD: string;
}

@Injectable()
export class BootstrapService {
  constructor(
    private readonly logger: CustomLogger,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  private getAdminData(): AdminData {
    return {
      EMAIL: process.env.APP_ADMIN_MAIL || '',
      NAME: process.env.APP_ADMIN_NAME || '',
      PASSWORD: process.env.APP_ADMIN_PASSWORD || '',
    };
  }

  /**
   * Automatically migrates legacy MongoDB documents to the standardized naming convention:
   * - posts: author -> user
   * - comments: author -> user, parentId -> parentComment
   */
  async migrateSchemaNaming() {
    try {
      if (!this.connection?.db) return;

      const postCol = this.connection.db.collection('posts');
      const commentCol = this.connection.db.collection('comments');

      // 1. Rename 'author' -> 'user' on posts collection
      const postResult = await postCol.updateMany(
        { author: { $exists: true } },
        { $rename: { author: 'user' } },
      );
      if (postResult.modifiedCount > 0) {
        this.logger.log(
          `[Migration] Successfully migrated ${postResult.modifiedCount} posts from 'author' to 'user'.`,
        );
      }

      // 2. Rename 'author' -> 'user' on comments collection
      const commentUserResult = await commentCol.updateMany(
        { author: { $exists: true } },
        { $rename: { author: 'user' } },
      );
      if (commentUserResult.modifiedCount > 0) {
        this.logger.log(
          `[Migration] Successfully migrated ${commentUserResult.modifiedCount} comments from 'author' to 'user'.`,
        );
      }

      // 3. Rename 'parentId' -> 'parentComment' on comments collection
      const commentParentResult = await commentCol.updateMany(
        { parentId: { $exists: true } },
        { $rename: { parentId: 'parentComment' } },
      );
      if (commentParentResult.modifiedCount > 0) {
        this.logger.log(
          `[Migration] Successfully migrated ${commentParentResult.modifiedCount} comments from 'parentId' to 'parentComment'.`,
        );
      }
    } catch (err) {
      this.logger.warn(`[Migration] Schema naming migration skipped or failed: ${err}`);
    }
  }

  async createAdmin() {
    // await this.resetAppPermissions();

    const { EMAIL, NAME, PASSWORD } = this.getAdminData();

    if (!EMAIL || !NAME || !PASSWORD) {
      const CustomError: ErrorResponse = {
        error: true,
        statusCode: 400,
        message: 'Admin credentials are not fully provided...',
        path: 'bootstrap-service-createAdmin',
        errorId: 1,
        timestamp: new Date(),
      };

      this.logger.error(CustomError);
      return;
    }

    try {
      const user = await this.userModel.findOne({ email: EMAIL });

      if (user == null) {
        await this.userModel.create({
          email: EMAIL,
          name: NAME,
          isEmailVerified: true,
          isAccountCompleted: false,
          password: PASSWORD,
          role: ROLE_VALUES.ADMIN,
          acceptTerms: true,
        });
      }
    } catch (error) {
      console.error('Error saving admin user:', error);
      throw error;
    }
  }

}
