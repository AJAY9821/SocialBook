import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CredentialsAuthService } from './credentials-auth.service';
import {
  LoginReqDto,
  LoginResDto,
  LogoutResDto,
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
import { Request } from 'express';
import { ErrorResponse } from 'src/utils/responses';
import { AuthGuard } from 'src/middlewares';

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
  async login(@Body() loginData: LoginReqDto) {
    return this.credentialsAuthService.login(loginData);
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
    description: 'Logs out the user by invalidating the active token.',
    type: LogoutResDto,
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: 'Unauthorized',
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Req() req: Request) {
    return this.credentialsAuthService.logout(req.headers.authorization);
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
