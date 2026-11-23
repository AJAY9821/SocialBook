import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Block extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  blocker: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  blocked: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BlockSchema = SchemaFactory.createForClass(Block);

BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
BlockSchema.index({ blocked: 1, blocker: 1 });
