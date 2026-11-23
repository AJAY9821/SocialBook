import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Story, StorySchema } from 'models/story';
import { User, UserSchema } from 'models/user';
import { Friendship, FriendshipSchema } from 'models/friendship';
import { AuthModule } from 'src/auth/auth.module';
import { ChatModule } from 'src/chat/chat.module';
import { BlocksModule } from 'src/blocks/blocks.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: User.name, schema: UserSchema },
      { name: Friendship.name, schema: FriendshipSchema },
    ]),
    AuthModule,
    ChatModule,
    BlocksModule,
  ],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService, MongooseModule],
})
export class StoriesModule {}
