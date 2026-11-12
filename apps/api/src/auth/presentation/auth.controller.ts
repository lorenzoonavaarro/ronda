import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Patch,
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
import { clearMemberCookies } from './clear-member-cookies';
import { readCookie, setSessionCookie } from './session-cookie';
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

    clearMemberCookies(response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest): AuthUser {
    return request.user;
  }

  @Patch('me')
  @UseGuards(SessionGuard)
  async updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<AuthUser> {
    return this.run(() => this.auth.updateProfile(request.user.id, body));
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
