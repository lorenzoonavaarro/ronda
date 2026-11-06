import { randomBytes, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { PaypalLinkStatus } from '@repo/api';

import { PaypalNotConfiguredError } from '../domain/errors';
import {
  buildAuthorizeUrl,
  readPaypalConfig,
  type PaypalConfig,
} from '../domain/paypal-config';
import { PAYPAL_IDENTITY, PAYPAL_REPOSITORY } from './ports';
import type { PaypalIdentity, PaypalRepository } from './ports';

@Injectable()
export class PaypalService {
  config: PaypalConfig = readPaypalConfig();
  states: () => string = () => randomBytes(32).toString('base64url');
  clock: () => Date = () => new Date();

  constructor(
    @Inject(PAYPAL_REPOSITORY) private readonly accounts: PaypalRepository,
    @Inject(PAYPAL_IDENTITY) private readonly identity: PaypalIdentity,
  ) {}

  status(
    account: Awaited<ReturnType<PaypalRepository['findByUser']>>,
  ): PaypalLinkStatus {
    return {
      configured: this.config.configured,
      environment: this.config.configured ? this.config.environment : null,
      returnUrl: this.config.returnUrl,
      account: account
        ? {
            fullName: account.fullName,
            email: account.email,
            emailVerified: account.emailVerified,
            accountVerified: account.accountVerified,
            accountType: account.accountType,
            payerId: account.payerId,
            linkedAt: account.linkedAt.toISOString(),
          }
        : null,
    };
  }

  async statusForUser(userId: string): Promise<PaypalLinkStatus> {
    return this.status(await this.accounts.findByUser(userId));
  }

  beginLink(): { state: string; url: string } {
    if (!this.config.configured) {
      throw new PaypalNotConfiguredError();
    }

    const state = this.states();

    return {
      state,
      url: buildAuthorizeUrl({
        connectBase: this.config.connectBase,
        clientId: this.config.clientId,
        returnUrl: this.config.returnUrl,
        state,
      }),
    };
  }

  statesMatch(left: string | undefined, right: string | undefined): boolean {
    if (!left || !right) {
      return false;
    }

    const actual = Buffer.from(left);
    const expected = Buffer.from(right);

    if (actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  }

  async completeLink(userId: string, code: string): Promise<void> {
    if (!this.config.configured) {
      throw new PaypalNotConfiguredError();
    }

    const profile = await this.identity.exchangeCode(code);

    await this.accounts.save({
      userId,
      payerId: profile.payerId,
      fullName: profile.fullName,
      email: profile.email,
      emailVerified: profile.emailVerified,
      accountVerified: profile.accountVerified,
      accountType: profile.accountType,
      linkedAt: this.clock(),
    });
  }

  async unlink(userId: string): Promise<void> {
    await this.accounts.delete(userId);
  }
}
