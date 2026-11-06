import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '@repo/api';
import type { Request } from 'express';

import { AuthService } from '../application/auth.service';
import { SESSION_COOKIE } from '../domain/session-token';
import { readCookie } from './session-cookie';

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = readCookie(request.headers.cookie, SESSION_COOKIE);

    if (!sessionToken) {
      throw new UnauthorizedException('Sign in required.');
    }

    const user = await this.auth.authenticate(sessionToken);

    if (!user) {
      throw new UnauthorizedException('Sign in required.');
    }

    request.user = user;
    return true;
  }
}
