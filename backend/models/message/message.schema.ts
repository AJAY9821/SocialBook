import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  content: string;

  @Prop({
    type: String,
    enum: ['text', 'audio'],
    default: 'text',
    index: true,
  })
  messageType: string;

  @Prop({ type: String, required: false })
  audioUrl?: string;

  @Prop({ type: Number, required: false })
  audioDuration?: number;

  @Prop({ type: [Number], required: false })
  audioWaveform?: number[];

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date, required: false })
  readAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Optimized compound indexes for chat queries
MessageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
MessageSchema.index({ recipient: 1, isRead: 1 });
