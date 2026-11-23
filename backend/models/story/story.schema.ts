import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum StoryMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  TEXT = 'text',
}

export enum StoryAudience {
  ALL = 'all',
  CLOSE_FRIENDS = 'close_friends',
  HIDE_FROM = 'hide_from',
}

@Schema({ timestamps: true })
export class Story extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true, alias: 'author' })
  user: Types.ObjectId;
  author?: Types.ObjectId;

  @Prop({ type: String, enum: StoryMediaType, required: true })
  mediaType: StoryMediaType;

  @Prop({ type: String, default: '' })
  mediaUrl: string;

  @Prop({ type: Number, default: 5, min: 1, max: 30 })
  duration: number; // in seconds (5s for image/text, up to 30s for video)

  @Prop({ type: String, default: '', maxlength: 500 })
  caption: string;

  @Prop({ type: String, default: 'from-pink-500 to-purple-600' })
  backgroundColor: string; // for text stories or gradients

  @Prop({ type: String, enum: StoryAudience, default: StoryAudience.ALL })
  audience: StoryAudience;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  customUserIds: Types.ObjectId[]; // excluded user IDs when audience == 'hide_from'

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  viewers: Types.ObjectId[]; // list of viewer user IDs

  @Prop({
    type: [
      {
        user: { type: Types.ObjectId, ref: 'User', required: true },
        reaction: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reactions: Array<{
    user: Types.ObjectId;
    reaction: string;
    createdAt: Date;
  }>;

  @Prop({
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  })
  expiresAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);

StorySchema.index({ user: 1, expiresAt: 1 });
