import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '@repo/api';
import type { Request } from 'express';

import { AuthService } from '../application/auth.service';
import {
  ClerkEmailLinkedError,
  ClerkNotConfiguredError,
} from '../domain/errors';

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    try {
      const user = await this.auth.userFromRequest(request);

      if (!user) {
        throw new UnauthorizedException('Sign in required.');
      }

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof ClerkNotConfiguredError) {
        throw new ServiceUnavailableException(error.message);
      }

      if (error instanceof ClerkEmailLinkedError) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }
}
