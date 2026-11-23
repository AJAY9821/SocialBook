import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Friendship, FriendshipSchema } from 'models/friendship';
import { User, UserSchema } from 'models/user';
import { AuthModule } from 'src/auth/auth.module';
import { BlocksModule } from 'src/blocks/blocks.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Friendship.name, schema: FriendshipSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    BlocksModule,
  ],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService, MongooseModule],
})
export class FriendsModule {}
