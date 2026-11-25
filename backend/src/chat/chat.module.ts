import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from 'models/message';
import { Friendship, FriendshipSchema } from 'models/friendship';
import { User, UserSchema } from 'models/user';
import { AuthModule } from 'src/auth/auth.module';
import { BlocksModule } from 'src/blocks/blocks.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Friendship.name, schema: FriendshipSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    BlocksModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway, MongooseModule],
})
export class ChatModule {}
