import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Comment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, alias: 'author' })
  user: Types.ObjectId;
  author?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null, index: true, alias: 'parentId' })
  parentComment?: Types.ObjectId | null;
  parentId?: Types.ObjectId | null;

  @Prop({ type: String, required: false, trim: true, maxlength: 2000, default: '' })
  content: string;

  @Prop({
    type: String,
    enum: ['text', 'gif'],
    default: 'text',
    index: true,
  })
  commentType: string;

  @Prop({ type: String, required: false, default: null })
  gifUrl?: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  likesCount: number;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ post: 1, parentComment: 1, createdAt: 1 });
CommentSchema.index({ post: 1, createdAt: -1 });
