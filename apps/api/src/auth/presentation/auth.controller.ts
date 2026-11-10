import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@repo/api';
import type { Response } from 'express';

import { AuthService } from '../application/auth.service';
import {
  EmailAlreadyRegisteredError,
  InvalidAuthInputError,
  InvalidCredentialsError,
  UsernameAlreadyTakenError,
} from '../domain/errors';
import { SESSION_COOKIE } from '../domain/session-token';
import {
  clearSessionCookie,
  readCookie,
  setSessionCookie,
} from './session-cookie';
import { SessionGuard, type AuthenticatedRequest } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const result = await this.run(() => this.auth.register(body));
    setSessionCookie(response, result.sessionToken);
    return result.user;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const result = await this.run(() => this.auth.login(body));
    setSessionCookie(response, result.sessionToken);
    return result.user;
  }

  @Post('supabase-login')
  @HttpCode(200)
  async supabaseLogin(@Body() body: unknown) {
    const session = await this.run(() => this.auth.loginWithSupabase(body));

    if (!session) {
      throw new UnauthorizedException('Username or password is incorrect.');
    }

    return {
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const sessionToken = readCookie(request.headers.cookie, SESSION_COOKIE);

    if (sessionToken) {
      await this.auth.logout(sessionToken);
    }

    clearSessionCookie(response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest): AuthUser {
    return request.user;
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof EmailAlreadyRegisteredError ||
        error instanceof UsernameAlreadyTakenError
      ) {
        throw new ConflictException(error.message);
      }

      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException(error.message);
      }

      if (error instanceof InvalidAuthInputError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
