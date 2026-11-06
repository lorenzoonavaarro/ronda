import { describe, expect, it } from '@jest/globals';

import { PaypalService } from './paypal.service';
import type {
  PaypalIdentity,
  PaypalRepository,
  StoredPaypalAccount,
} from './ports';
import { PaypalAccountTakenError } from '../domain/errors';
import { buildAuthorizeUrl } from '../domain/paypal-config';
import {
  InvalidPaypalProfileError,
  parsePaypalProfile,
} from '../domain/paypal-profile';

class MemoryPaypal implements PaypalRepository {
  readonly rows: StoredPaypalAccount[] = [];

  async findByUser(userId: string): Promise<StoredPaypalAccount | null> {
    return this.rows.find((row) => row.userId === userId) ?? null;
  }

  async save(account: StoredPaypalAccount): Promise<void> {
    const taken = this.rows.find(
      (row) => row.payerId === account.payerId && row.userId !== account.userId,
    );

    if (taken) {
      throw new PaypalAccountTakenError();
    }

    const index = this.rows.findIndex((row) => row.userId === account.userId);

    if (index === -1) {
      this.rows.push(account);
      return;
    }

    this.rows[index] = account;
  }

  async delete(userId: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.userId === userId);

    if (index >= 0) {
      this.rows.splice(index, 1);
    }
  }
}

function createService() {
  const accounts = new MemoryPaypal();
  const identity: PaypalIdentity = {
    async exchangeCode() {
      return {
        payerId: 'PAYER123',
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        emailVerified: true,
        accountVerified: true,
        accountType: 'PERSONAL',
      };
    },
  };
  const service = new PaypalService(accounts, identity);
  service.config = {
    configured: true,
    environment: 'sandbox',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    returnUrl: 'http://localhost:3000/paypal/callback',
    webOrigin: 'http://localhost:3001',
    apiBase: 'https://api-m.sandbox.paypal.com',
    connectBase: 'https://www.sandbox.paypal.com',
    webhookId: '',
  };
  service.states = () => 'state-token';
  service.clock = () => new Date('2026-11-06T12:00:00.000Z');
  return { service, accounts };
}

describe('PaypalService', () => {
  it('builds a sandbox authorize URL without the client secret', () => {
    const { service } = createService();
    const started = service.beginLink();
    const url = new URL(started.url);

    expect(url.origin).toBe('https://www.sandbox.paypal.com');
    expect(url.pathname).toBe('/connect');
    expect(url.searchParams.get('flowEntry')).toBe('static');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/paypal/callback',
    );
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('fullPage')).toBe('true');
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('scope')).toContain(
      'https://uri.paypal.com/services/paypalattributes',
    );
    expect(started.url).not.toContain('client-secret');
  });

  it('stores the PayPal profile and refuses a payer already linked elsewhere', async () => {
    const { service } = createService();

    await service.completeLink('user-1', 'auth-code');
    const status = await service.statusForUser('user-1');

    expect(status.account).toEqual({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      emailVerified: true,
      accountVerified: true,
      accountType: 'PERSONAL',
      payerId: 'PAYER123',
      linkedAt: '2026-11-06T12:00:00.000Z',
    });
    expect(status.environment).toBe('sandbox');

    await expect(
      service.completeLink('user-2', 'auth-code'),
    ).rejects.toBeInstanceOf(PaypalAccountTakenError);

    await service.unlink('user-1');
    expect((await service.statusForUser('user-1')).account).toBeNull();
  });

  it('reads the account id, name, email, and verification flags', () => {
    expect(
      parsePaypalProfile({
        user_id: 'PAYER123',
        email: 'ada@example.com',
        email_verified: true,
        verified_account: 'true',
        account_type: 'BUSINESS',
        given_name: 'Ada',
        family_name: 'Lovelace',
      }),
    ).toMatchObject({
      payerId: 'PAYER123',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      emailVerified: true,
      accountVerified: true,
      accountType: 'BUSINESS',
    });

    expect(() => parsePaypalProfile({ email: 'ada@example.com' })).toThrow(
      InvalidPaypalProfileError,
    );
  });

  it('keeps the secret out of the authorize helper', () => {
    const url = buildAuthorizeUrl({
      connectBase: 'https://www.sandbox.paypal.com',
      clientId: 'client-id',
      returnUrl: 'http://localhost:3000/paypal/callback',
      state: 'state-token',
    });

    expect(url).not.toContain('client-secret');
  });
});
