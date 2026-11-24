import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum FRIENDSHIP_STATUS {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Friendship extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  requester: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId;

  @Prop({
    type: String,
    enum: FRIENDSHIP_STATUS,
    default: FRIENDSHIP_STATUS.PENDING,
  })
  status: FRIENDSHIP_STATUS;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FriendshipSchema = SchemaFactory.createForClass(Friendship);

FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
FriendshipSchema.index({ recipient: 1, status: 1, createdAt: -1 });
FriendshipSchema.index({ requester: 1, status: 1, createdAt: -1 });
