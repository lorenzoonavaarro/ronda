import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '@repo/api';
import type { Request } from 'express';

import { AuthService } from '../application/auth.service';
import { SupabaseTokenService } from '../infrastructure/supabase-token.service';
import { readCookie } from './session-cookie';

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly supabase: SupabaseTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const accessToken = readCookie(
      request.headers.cookie,
      'ronda_access_token',
    );

    const bearer = bearerToken(request.headers.authorization);
    const identity = await this.supabase.userForToken(
      bearer || accessToken || '',
    );

    if (!identity?.id || !identity.email) {
      throw new UnauthorizedException('Sign in required.');
    }

    request.user = await this.auth.syncSupabaseUser({
      id: identity.id,
      email: identity.email,
      username: metadataString(identity.user_metadata.username),
      displayName: metadataString(identity.user_metadata.display_name),
    });
    return true;
  }
}

function bearerToken(value: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(value ?? '');
  return match?.[1];
}

function metadataString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}
