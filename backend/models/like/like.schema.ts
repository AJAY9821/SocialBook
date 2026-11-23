import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum REACTION_TYPE {
  LIKE = 'like',
  LOVE = 'love',
  HAHA = 'haha',
  WOW = 'wow',
  SAD = 'sad',
  ANGRY = 'angry',
}

@Schema({ timestamps: true })
export class Like extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(REACTION_TYPE),
    default: REACTION_TYPE.LIKE,
    index: true,
  })
  reactionType: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LikeSchema = SchemaFactory.createForClass(Like);

LikeSchema.index({ user: 1, post: 1 }, { unique: true });
LikeSchema.index({ post: 1, reactionType: 1 });
