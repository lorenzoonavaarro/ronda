import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { PaypalLinkStatus } from '@repo/api';
import type { Request, Response } from 'express';

import { AuthService } from '../../auth/application/auth.service';
import { ClerkNotConfiguredError } from '../../auth/domain/errors';
import {
  clearFlowActor,
  flowActorFromRequestCookie,
  rememberFlowActor,
} from '../../auth/presentation/flow-actor-cookie';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { readCookie } from '../../auth/presentation/session-cookie';
import { PaypalService } from '../application/paypal.service';
import {
  PaypalAccountTakenError,
  PaypalIdentityError,
  PaypalNotConfiguredError,
} from '../domain/errors';
import { localhostCallbackRedirect, pageOrigin } from '../domain/paypal-config';
import { InvalidPaypalProfileError } from '../domain/paypal-profile';

const STATE_COOKIE = 'ronda_paypal_state';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

@Controller('paypal')
export class PaypalController {
  constructor(
    private readonly paypal: PaypalService,
    private readonly auth: AuthService,
  ) {}

  @Get('account')
  @UseGuards(SessionGuard)
  account(@Req() request: AuthenticatedRequest): Promise<PaypalLinkStatus> {
    return this.paypal.statusForUser(request.user.id);
  }

  @Post('unlink')
  @UseGuards(SessionGuard)
  async unlink(
    @Req() request: AuthenticatedRequest,
  ): Promise<PaypalLinkStatus> {
    await this.paypal.unlink(request.user.id);
    return this.paypal.statusForUser(request.user.id);
  }

  @Get('link')
  @UseGuards(SessionGuard)
  linkFromGet(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): void {
    this.startLink(request, response);
  }

  @Post('link')
  @UseGuards(SessionGuard)
  linkFromPost(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): void {
    this.startLink(request, response);
  }

  private startLink(request: AuthenticatedRequest, response: Response): void {
    try {
      const started = this.paypal.beginLink();
      rememberFlowActor(response, request.user.id);
      response.cookie(
        STATE_COOKIE,
        started.state,
        cookieOptions(STATE_MAX_AGE_MS),
      );
      response.redirect(started.url);
    } catch (error) {
      if (error instanceof PaypalNotConfiguredError) {
        response.redirect(this.settingsUrl(request, 'unavailable'));
        return;
      }

      throw error;
    }
  }

  @Get('callback')
  async callback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code?: string | string[],
    @Query('state') state?: string | string[],
    @Query('error') oauthError?: string | string[],
  ): Promise<void> {
    const forwarded = localhostCallbackRedirect(
      request.hostname,
      process.env.PORT ?? '3000',
      {
        code: firstQuery(code),
        state: firstQuery(state),
        error: firstQuery(oauthError),
      },
    );

    if (forwarded) {
      response.redirect(forwarded);
      return;
    }

    const clearState = () => {
      response.clearCookie(STATE_COOKIE, cookieOptions());
      clearFlowActor(response);
    };
    const userId = await this.actorId(request);

    if (!userId) {
      clearState();
      response.redirect(signInUrl(this.webOrigin(request), '/settings'));
      return;
    }

    const returnedState = firstQuery(state);
    const expectedState = readCookie(request.headers.cookie, STATE_COOKIE);

    if (firstQuery(oauthError) || !firstQuery(code)) {
      clearState();
      response.redirect(this.settingsUrl(request, 'denied'));
      return;
    }

    if (!this.paypal.statesMatch(expectedState, returnedState)) {
      clearState();
      response.redirect(this.settingsUrl(request, 'state'));
      return;
    }

    try {
      await this.paypal.completeLink(userId, firstQuery(code) ?? '');
      clearState();
      response.redirect(this.settingsUrl(request, 'linked'));
    } catch (error) {
      clearState();
      const result =
        error instanceof PaypalAccountTakenError
          ? 'taken'
          : error instanceof PaypalNotConfiguredError
            ? 'unavailable'
            : error instanceof PaypalIdentityError ||
                error instanceof InvalidPaypalProfileError
              ? 'exchange'
              : 'exchange';
      response.redirect(this.settingsUrl(request, result));
    }
  }

  private settingsUrl(request: Request, result: string): string {
    const url = new URL('/settings', this.webOrigin(request));
    url.searchParams.set('paypal', result);
    return url.toString();
  }

  private webOrigin(request: Request): string {
    return pageOrigin(request.hostname, this.paypal.config.webOrigin);
  }

  private async actorId(request: Request): Promise<string | null> {
    const user = await this.member(request);
    return user?.id ?? flowActorFromRequestCookie(request.headers.cookie);
  }

  private async member(request: Request) {
    try {
      return await this.auth.userFromRequest(request);
    } catch (error) {
      if (error instanceof ClerkNotConfiguredError) {
        return null;
      }

      throw error;
    }
  }
}

function signInUrl(origin: string, next: string): string {
  const url = new URL('/sign-in', origin);
  url.searchParams.set('redirect_url', next);
  return url.toString();
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  return typeof item === 'string' && item.length > 0 ? item : undefined;
}

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}
