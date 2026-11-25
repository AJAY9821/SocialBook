import { Module } from '@nestjs/common';
import { CredentialsAuthService } from './credentials-auth/credentials-auth.service';
import { CredentialsAuthController } from './credentials-auth/credentials-auth.controller';
import { UserVerificationService } from './credentials-auth/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'models/user';
import { CommonModule } from 'src/common/common.module';
import {
  RefreshToken,
  RefreshTokenSchema,
  VerificationToken,
  VerificationTokenSchema,
} from 'models/auth';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from 'src/middlewares';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: VerificationToken.name, schema: VerificationTokenSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    JwtModule.register({}),
    CommonModule,
  ],
  controllers: [CredentialsAuthController],
  providers: [CredentialsAuthService, UserVerificationService, AuthGuard],
  exports: [MongooseModule, CommonModule, UserVerificationService, AuthGuard, JwtModule],
})
export class AuthModule {}
