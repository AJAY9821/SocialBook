import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CredentialsAuthService } from './credentials-auth.service';
import {
  LoginReqDto,
  LoginResDto,
  LogoutResDto,
  RefreshTokenReqDto,
  RefreshTokenResDto,
  RegisterReqDto,
  RegisterResDto,
} from './credentials-auth-dto';
import {
  forgotPassReqDTO,
  forgotPassResDTO,
  ResetPassReqDTO,
  ResetPassResDTO,
} from './common/user-verification-dto';
import { UserVerificationService } from './common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response, CookieOptions } from 'express';
import { ErrorResponse } from 'src/utils/responses';
import { AuthGuard } from 'src/middlewares';

const REFRESH_COOKIE_NAME = 'socialbook_refresh_token';

const getCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: Number(process.env.REFRESH_TOKEN_EXPIRY) || 7 * 24 * 60 * 60 * 1000,
});

function extractCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

@ApiTags('Authentication')
@Controller('auth')
export class CredentialsAuthController {
  constructor(
    private readonly credentialsAuthService: CredentialsAuthService,
    private readonly userVerificationService: UserVerificationService,
  ) {}

  @ApiResponse({
    status: 201,
    description: 'Registers a new user.',
    type: RegisterResDto,
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: 'Bad Request',
  })
  @Post('register')
  async register(@Body() registerData: RegisterReqDto) {
    return this.credentialsAuthService.register(registerData);
  }

  @ApiResponse({
    status: 200,
    description: 'Authenticates and logs in a user.',
    type: LoginResDto,
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: 'Invalid credentials',
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginData: LoginReqDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.credentialsAuthService.login(loginData);
    if (result.refreshToken) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());
    }
    const { refreshToken, ...safeResponse } = result as any;
    return safeResponse;
  }

  @ApiResponse({
    status: 200,
    description: 'Generates a password reset link.',
    type: forgotPassResDTO,
  })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPassData: forgotPassReqDTO,
    @Req() req: Request,
  ) {
    return this.userVerificationService.sendForgotPassEmail(forgotPassData, req);
  }

  @ApiResponse({
    status: 200,
    description: 'Resets the user password with a valid token.',
    type: ResetPassResDTO,
  })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() resetPassData: ResetPassReqDTO) {
    return this.userVerificationService.resetPassword(resetPassData);
  }

  @ApiResponse({
    status: 200,
    description: 'Refreshes an expired access token using a valid refresh token.',
    type: RefreshTokenResDto,
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: 'Refresh token expired or invalid.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() refreshData?: Partial<RefreshTokenReqDto>,
  ) {
    const token =
      extractCookie(req, REFRESH_COOKIE_NAME) ||
      refreshData?.refreshToken;

    if (!token) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const result = await this.credentialsAuthService.refresh(token);
    if (result.refreshToken) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());
    }
    const { refreshToken, ...safeResponse } = result as any;
    return safeResponse;
  }

  @ApiResponse({
    status: 200,
    description: 'Logs out the user by invalidating the active session token.',
    type: LogoutResDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: Partial<RefreshTokenReqDto>,
  ) {
    const token =
      extractCookie(req, REFRESH_COOKIE_NAME) ||
      body?.refreshToken;

    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return this.credentialsAuthService.logout(
      req.headers.authorization,
      token,
    );
  }

  @ApiResponse({
    status: 200,
    description: 'Returns the currently authenticated user.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: 'Unauthorized',
  })
  @ApiBearerAuth()
  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Req() req: Request) {
    return this.credentialsAuthService.getMe(req['user']);
  }
}
