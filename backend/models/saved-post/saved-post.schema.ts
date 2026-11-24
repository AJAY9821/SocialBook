import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class SavedPost extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SavedPostSchema = SchemaFactory.createForClass(SavedPost);

SavedPostSchema.index({ user: 1, post: 1 }, { unique: true });
SavedPostSchema.index({ user: 1, createdAt: -1 });
