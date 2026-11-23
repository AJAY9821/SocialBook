import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from 'models/post';
import { Friendship, FriendshipSchema } from 'models/friendship';
import { Like, LikeSchema } from 'models/like';
import { AuthModule } from 'src/auth/auth.module';
import { BlocksModule } from 'src/blocks/blocks.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Friendship.name, schema: FriendshipSchema },
      { name: Like.name, schema: LikeSchema },
    ]),
    AuthModule,
    BlocksModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService, MongooseModule],
})
export class PostsModule {}
