import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Post extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true, alias: 'author' })
  user: Types.ObjectId;
  author?: Types.ObjectId;

  @Prop({ type: String, required: false, trim: true, maxlength: 5000, default: '' })
  content: string;

  @Prop({ type: String, required: false, default: '' })
  imageUrl?: string;

  @Prop({ type: String, required: false, default: '' })
  videoUrl?: string;

  @Prop({
    type: String,
    enum: ['text', 'image', 'video'],
    default: 'text',
  })
  mediaType?: 'text' | 'image' | 'video';

  @Prop({ type: Number, required: false, default: 0 })
  videoDuration?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  likesCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  commentsCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  sharesCount: number;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: false, default: null })
  originalPost?: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ user: 1, isDeleted: 1, createdAt: -1 });
PostSchema.index({ originalPost: 1 });
