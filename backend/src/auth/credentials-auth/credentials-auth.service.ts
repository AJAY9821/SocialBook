import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'models/user';
import { Model } from 'mongoose';
import {
  LoginReqDto,
  LoginResDto,
  LogoutResDto,
  RefreshTokenResDto,
  RegisterReqDto,
  RegisterResDto,
} from './credentials-auth-dto';
import { CustomLogger } from 'src/common/services/logger.service';
import { RefreshToken } from 'models/auth';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { UserProfileDto } from 'src/user/user/user-dto';

@Injectable()
export class CredentialsAuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,

    private readonly logger: CustomLogger,
    private readonly jwtService: JwtService,
  ) {
    this.logger.setContext('CredentialsAuth');
  }

  async register(registerData: RegisterReqDto): Promise<RegisterResDto> {
    const { name, email, password, acceptTerms } = registerData;

    if (!acceptTerms) {
      throw new BadRequestException(
        'To proceed, please agree to our terms and conditions.',
      );
    }

    const existingUser = await this.userModel.findOne({ email });

    if (existingUser) {
      if (existingUser.isDeleted) {
        throw new BadRequestException(
          'This account has been deactivated. Contact the admin for reactivation.',
        );
      }

      throw new BadRequestException('An account with this email already exists.');
    }

    const newUser = await this.userModel.create({
      name,
      email,
      password,
      acceptTerms,
      isEmailVerified: true,
    });

    return {
      error: false,
      statusCode: HttpStatus.CREATED,
      msg: 'Registration complete! You can now log in.',
      user: UserProfileDto.transform(newUser),
    };
  }

  async login(loginData: LoginReqDto): Promise<LoginResDto> {
    const { email, password } = loginData;

    const user = await this.validateUser(email);

    if (user.isDeleted) {
      throw new UnauthorizedException('This account has been deactivated.');
    }

    await this.verifyAccountPassword(user, password);

    const refreshTokenData = await this.generateRefreshToken(user);
    const accessTokenData = await this.generateAccessToken(user);

    return this.sendLoginResponse(
      user,
      accessTokenData.token,
      refreshTokenData.token,
      accessTokenData.expiryInMs,
    );
  }

  async refresh(refreshToken: string): Promise<RefreshTokenResDto> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    try {
      this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET as string,
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token is invalid or expired. Please log in again.',
      );
    }

    const tokenDoc = await this.refreshTokenModel.findOne({
      token: refreshToken,
      isExpired: false,
    });

    if (!tokenDoc || tokenDoc.expiry <= new Date()) {
      if (tokenDoc) {
        tokenDoc.isExpired = true;
        await tokenDoc.save();
      }
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user || user.isDeleted) {
      throw new UnauthorizedException(
        'User account no longer exists or has been deactivated.',
      );
    }

    const accessTokenData = await this.generateAccessToken(user);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Session refreshed successfully!',
      accessToken: accessTokenData.token,
      refreshToken: tokenDoc.token,
      expiry: accessTokenData.expiryInMs,
    };
  }

  async logout(
    authHeader?: string,
    refreshToken?: string,
  ): Promise<LogoutResDto> {
    if (refreshToken) {
      await this.refreshTokenModel.updateOne(
        { token: refreshToken },
        { isExpired: true, expiry: new Date() },
      );
    } else if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      try {
        const decoded: any = this.jwtService.decode(token);
        const userId = decoded?.user?.id || decoded?.sub;
        if (userId) {
          await this.refreshTokenModel.updateMany(
            { userId, isExpired: false },
            { isExpired: true, expiry: new Date() },
          );
        }
      } catch {
        // Silently continue
      }
    }

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'You have logged out successfully!',
    };
  }

  getMe(user: User) {
    return {
      error: false,
      statusCode: HttpStatus.OK,
      user: UserProfileDto.transform(user),
    };
  }

  private async validateUser(email: string): Promise<User> {
    const user = await this.userModel.findOne({ email }).select('+password');

    if (!user) {
      throw new NotFoundException(
        "This account doesn't seem to exist. Please sign up to get started!",
      );
    }

    return user;
  }

  private async verifyAccountPassword(
    user: User,
    password: string,
  ): Promise<void> {
    const isPasswordMatched = await argon2.verify(user.password, password);

    if (!isPasswordMatched) {
      throw new UnauthorizedException('Invalid email or password.');
    }
  }

  async generateRefreshToken(user: User): Promise<RefreshToken> {
    const payload = {
      email: user.email,
      user: {
        id: user.id,
        name: user.name,
      },
    };

    const jwtRefreshToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_REFRESH_TOKEN_LIFETIME || '7d',
      subject: user.email,
      algorithm: 'HS512',
      secret: process.env.JWT_REFRESH_TOKEN_SECRET as string,
    });

    const refreshExpiryMs =
      Number(process.env.REFRESH_TOKEN_EXPIRY) || 7 * 24 * 60 * 60 * 1000;

    const expiryInMs = new Date(Date.now() + refreshExpiryMs);

    return this.refreshTokenModel.create({
      token: jwtRefreshToken,
      expiry: expiryInMs,
      userId: user.id,
    });
  }

  async generateAccessToken(user: User): Promise<{
    token: string;
    expiryInMs: Date;
  }> {
    const userId = user.id || (user as any)._id?.toString();
    const payload = {
      sub: userId,
      email: user.email,
      role: (user as any).role || 'user',
      user: {
        id: userId,
        name: user.name,
      },
    };

    const jwtAccessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_TOKEN_LIFETIME || '15m',
      algorithm: 'HS512',
      secret: process.env.JWT_ACCESS_TOKEN_SECRET as string,
    });

    const accessExpiryMs =
      Number(process.env.ACCESS_TOKEN_EXPIRY) || 15 * 60 * 1000;

    const expiryInMs = new Date(Date.now() + accessExpiryMs);

    return { token: jwtAccessToken, expiryInMs };
  }

  private sendLoginResponse(
    user: User,
    accessToken: string,
    refreshToken: string,
    expiry: Date,
  ): LoginResDto {
    const userProfile = UserProfileDto.transform(user);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'You have logged in successfully!',
      accessToken,
      refreshToken,
      expiry,
      user: userProfile,
    } as LoginResDto;
  }
}
