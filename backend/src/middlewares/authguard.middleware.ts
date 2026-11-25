import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ROLE_VALUES, User } from 'models/user/user.schema';
import { Model, Types } from 'mongoose';
import { CustomLogger } from 'src/common/services';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly logger: CustomLogger,
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    this.logger.setContext('AuthGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authority = this.reflector.get<boolean>(
      'authority',
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const authHeader = request.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      throw new UnauthorizedException('Login to access this route...');
    }

    try {
      // 1. Fast cryptographic verification in RAM (0 DB queries, < 0.1ms)
      const payload: any = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_TOKEN_SECRET as string,
      });

      const rawUserId = payload?.user?.id || payload?.sub;
      if (!rawUserId || !Types.ObjectId.isValid(rawUserId)) {
        throw new UnauthorizedException(
          'Authentication token is invalid or malformed.',
        );
      }

      const userObjectId = new Types.ObjectId(rawUserId);

      // 2. Attach authenticated user object directly to the request
      request['user'] = {
        _id: userObjectId,
        id: rawUserId,
        email: payload.email,
        name: payload?.user?.name || '',
        role: payload.role || 'user',
      };

      // 3. Admin / Authority permission check
      if (authority) {
        const isAdmin = payload.role === ROLE_VALUES.ADMIN;
        if (!isAdmin) {
          const user = await this.userModel.findById(userObjectId);
          if (!user || user.role !== ROLE_VALUES.ADMIN) {
            throw new UnauthorizedException(
              'User does not have permissions to access this route.',
            );
          }
          request['user'] = user;
        }
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Authentication token is missing, expired or invalid. Please refresh session.',
      );
    }
  }
}
