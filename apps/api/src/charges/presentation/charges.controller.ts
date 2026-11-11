import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from '../../auth/application/auth.service';
import { ClerkNotConfiguredError } from '../../auth/domain/errors';
import {
  clearFlowActor,
  flowActorFromRequestCookie,
  rememberFlowActor,
} from '../../auth/presentation/flow-actor-cookie';
import { readCookie } from '../../auth/presentation/session-cookie';
import { pageOrigin, vaultReturnUrl } from '../../paypal/domain/paypal-config';
import { ChargesService } from '../application/charges.service';
import { PaypalVaultError } from '../domain/errors';

const SETUP_COOKIE = 'ronda_paypal_vault';
const CIRCLE_COOKIE = 'ronda_paypal_vault_circle';
const SETUP_MAX_AGE_MS = 15 * 60 * 1000;

@Controller('paypal')
export class ChargesController {
  constructor(
    private readonly charges: ChargesService,
    private readonly auth: AuthService,
  ) {}

  @Get('vault/start')
  @Post('vault/start')
  async start(
    @Req() request: Request,
    @Res() response: Response,
    @Query('circle') circle?: string,
  ): Promise<void> {
    const forwarded = localhostForward(request, '/paypal/vault/start');

    if (forwarded) {
      response.redirect(forwarded);
      return;
    }

    const circleId = isUuid(circle) ? circle : null;
    const user = await this.member(request);

    if (!user) {
      const next = circleId ? `/circles/${circleId}` : '/settings';
      response.redirect(signInUrl(this.webOrigin(request), next));
      return;
    }

    const returnUrl = vaultReturnUrl();

    try {
      rememberFlowActor(response, user.id);
      const started = await this.charges.beginApproval({
        returnUrl,
        cancelUrl: `${returnUrl}?cancelled=1`,
      });
      response.cookie(
        SETUP_COOKIE,
        started.setupTokenId,
        cookieOptions(SETUP_MAX_AGE_MS),
      );

      if (circleId) {
        response.cookie(
          CIRCLE_COOKIE,
          circleId,
          cookieOptions(SETUP_MAX_AGE_MS),
        );
      }

      response.redirect(started.approveUrl);
    } catch (error) {
      if (error instanceof PaypalVaultError) {
        response.redirect(
          await this.doneUrl(request, circleId, 'unavailable', user.id),
        );
        return;
      }

      throw error;
    }
  }

  @Get('vault/callback')
  async callback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('cancelled') cancelled?: string,
    @Query('approval_token_id') approvalTokenId?: string,
  ): Promise<void> {
    const forwarded = localhostVaultRedirect(request);

    if (forwarded) {
      response.redirect(forwarded);
      return;
    }

    const clear = () => {
      response.clearCookie(SETUP_COOKIE, cookieOptions());
      response.clearCookie(CIRCLE_COOKIE, cookieOptions());
      clearFlowActor(response);
    };
    const user = await this.member(request);
    const actorId =
      user?.id ?? flowActorFromRequestCookie(request.headers.cookie);
    const circleId = readCookie(request.headers.cookie, CIRCLE_COOKIE);

    if (!actorId) {
      clear();
      response.redirect(signInUrl(this.webOrigin(request), '/settings'));
      return;
    }

    if (cancelled === '1') {
      clear();
      response.redirect(
        await this.doneUrl(request, circleId, 'denied', actorId),
      );
      return;
    }

    const setupTokenId = readCookie(request.headers.cookie, SETUP_COOKIE);

    if (
      !setupTokenId ||
      (approvalTokenId && approvalTokenId !== setupTokenId)
    ) {
      clear();
      response.redirect(
        await this.doneUrl(request, circleId, 'unavailable', actorId),
      );
      return;
    }

    try {
      await this.charges.completeApproval(actorId, setupTokenId);
      clear();
      response.redirect(
        await this.doneUrl(request, circleId, 'approved', actorId),
      );
    } catch (error) {
      clear();

      if (error instanceof PaypalVaultError) {
        response.redirect(
          await this.doneUrl(request, circleId, 'unavailable', actorId),
        );
        return;
      }

      throw error;
    }
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() request: RawBodyRequest<Request>): Promise<void> {
    const raw = request.rawBody;

    if (!raw) {
      throw new UnauthorizedException();
    }

    const accepted = await this.charges.receiveWebhook(raw, request.headers);

    if (!accepted) {
      throw new UnauthorizedException();
    }
  }

  private async doneUrl(
    request: Request,
    circleId: string | null | undefined,
    result: string,
    userId: string,
  ): Promise<string> {
    const origin = this.webOrigin(request);
    const member =
      circleId && isUuid(circleId)
        ? await this.charges.memberOf(circleId, userId)
        : false;
    const path = member ? `/circles/${circleId}` : '/settings';
    const url = new URL(path, origin);
    url.searchParams.set('charges', result);
    return url.toString();
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

  private webOrigin(request: Request): string {
    return pageOrigin(
      request.hostname,
      process.env.WEB_ORIGIN?.trim() || 'http://localhost:3001',
    );
  }
}

function localhostVaultRedirect(request: Request): string | null {
  return localhostForward(request, '/paypal/vault/callback');
}

function localhostForward(request: Request, path: string): string | null {
  if (request.hostname !== '127.0.0.1') {
    return null;
  }

  const port = /^\d{1,5}$/.test(process.env.PORT ?? '')
    ? process.env.PORT
    : '3000';
  const url = new URL(`http://localhost:${port}${path}`);

  for (const [key, value] of Object.entries(request.query)) {
    if (typeof value === 'string' && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function signInUrl(origin: string, next: string): string {
  const url = new URL('/sign-in', origin);
  url.searchParams.set('redirect_url', next);
  return url.toString();
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

function isUuid(value: string | undefined | null): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
