import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as argon2 from 'argon2';

export enum ROLE_VALUES {
  ADMIN = 'admin',
  USER = 'user',
}


@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: String, required: true, unique: true })
  email: string;

  @Prop({
    type: String,
    required: true,
    minlength: [8, 'password must be of atleast 8 letters !!'],
    select: false,
  })
  password: string;

  @Prop({ type: String, enum: ROLE_VALUES, default: ROLE_VALUES.USER })
  role: ROLE_VALUES;

  @Prop({
    type: String,
    required: false,
    minlength: [3, 'name must be of atleast 3 letters !!'],
  })
  name: string;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;

  @Prop({ type: Boolean, default: false })
  isAccountCompleted: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Boolean, required: true })
  acceptTerms: boolean;

  @Prop({ type: String, required: false, default: '', maxlength: 300, trim: true })
  bio?: string;

  @Prop({ type: String, required: false, default: '', trim: true })
  avatarUrl?: string;

  @Prop({ type: String, required: false, default: '', trim: true })
  coverUrl?: string;

  @Prop({ type: String, required: false, default: '', maxlength: 100, trim: true })
  location?: string;

  @Prop({ type: String, required: false, default: '', maxlength: 200, trim: true })
  website?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function (next) {
  const user = this as any;

  if (user.isModified('password') && user.password) {
    user.password = await argon2.hash(user.password);
  }

  next();
});
