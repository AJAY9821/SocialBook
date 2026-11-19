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
  RegisterReqDto,
  RegisterResDto,
} from './credentials-auth-dto';
import { CustomLogger } from 'src/common/services/logger.service';
import { AccessToken, RefreshToken } from 'models/auth';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { UserProfileDto } from 'src/user/user/user-dto';

@Injectable()
export class CredentialsAuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    @InjectModel(AccessToken.name)
    private readonly accessTokenModel: Model<AccessToken>,

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

    // Expire any previous active session tokens for this user
    await this.refreshTokenModel.updateMany(
      { userId: user.id, isExpired: false },
      { isExpired: true },
    );

    await this.accessTokenModel.updateMany(
      { userId: user.id, isExpired: false },
      { isExpired: true },
    );

    const refreshTokenData = await this.generateRefreshToken(user);
    const accessTokenData = await this.generateAccessToken(
      user,
      refreshTokenData,
    );

    return this.sendLoginResponse(
      user,
      accessTokenData.token,
      accessTokenData.expiryInMs,
    );
  }

  async logout(authHeader: string): Promise<LogoutResDto> {
    const authorization = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!authorization) {
      throw new UnauthorizedException(
        'Access token is missing. Please log in again.',
      );
    }

    const accessToken = await this.accessTokenModel.findOne({
      token: authorization,
      isExpired: false,
    });

    if (!accessToken) {
      throw new UnauthorizedException(
        'Access token is missing or already expired. Please log in again.',
      );
    }

    await this.accessTokenModel.findByIdAndUpdate(accessToken._id, {
      expiry: new Date(),
      isExpired: true,
    });

    await this.refreshTokenModel.findByIdAndUpdate(accessToken.refreshTokenId, {
      expiry: new Date(),
      isExpired: true,
    });

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

  async generateAccessToken(
    user: User,
    refreshToken: RefreshToken,
  ): Promise<{
    token: string;
    expiryInMs: Date;
  }> {
    const payload = {
      email: user.email,
      user: {
        id: user.id,
        name: user.name,
      },
    };

    const jwtAccessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_TOKEN_LIFETIME || '1d',
      subject: user.email,
      algorithm: 'HS512',
      secret: process.env.JWT_ACCESS_TOKEN_SECRET as string,
    });

    const accessExpiryMs =
      Number(process.env.ACCESS_TOKEN_EXPIRY) || 24 * 60 * 60 * 1000;

    const expiryInMs = new Date(Date.now() + accessExpiryMs);

    await this.accessTokenModel.create({
      token: jwtAccessToken,
      expiry: expiryInMs,
      userId: user.id,
      refreshTokenId: refreshToken.id,
    });

    return { token: jwtAccessToken, expiryInMs };
  }

  private sendLoginResponse(
    user: User,
    accessToken: string,
    expiry: Date,
  ): LoginResDto {
    const userProfile = UserProfileDto.transform(user);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'You have logged in successfully!',
      accessToken,
      expiry,
      user: userProfile,
    } as LoginResDto;
  }
}
