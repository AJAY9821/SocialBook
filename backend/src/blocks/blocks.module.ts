import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Block, BlockSchema } from 'models/block';
import { User, UserSchema } from 'models/user';
import { Friendship, FriendshipSchema } from 'models/friendship';
import { AuthModule } from 'src/auth/auth.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Block.name, schema: BlockSchema },
      { name: User.name, schema: UserSchema },
      { name: Friendship.name, schema: FriendshipSchema },
    ]),
    AuthModule,
  ],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService, MongooseModule],
})
export class BlocksModule {}
