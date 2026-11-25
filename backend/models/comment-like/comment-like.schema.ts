import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { REACTION_TYPE } from '../like/like.schema';

export { REACTION_TYPE };

@Schema({ timestamps: true })
export class CommentLike extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment', required: true, index: true })
  comment: Types.ObjectId;

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

export const CommentLikeSchema = SchemaFactory.createForClass(CommentLike);

CommentLikeSchema.index({ user: 1, comment: 1 }, { unique: true });
CommentLikeSchema.index({ comment: 1, reactionType: 1 });
