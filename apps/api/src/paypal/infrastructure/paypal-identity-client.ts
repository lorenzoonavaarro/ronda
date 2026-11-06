import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PaypalIdentityError } from '../domain/errors';
import { readPaypalConfig } from '../domain/paypal-config';
import {
  parsePaypalProfile,
  type PaypalProfile,
} from '../domain/paypal-profile';
import type { PaypalIdentity } from '../application/ports';

@Injectable()
export class PaypalIdentityClient implements PaypalIdentity {
  async exchangeCode(code: string): Promise<PaypalProfile> {
    const config = readPaypalConfig();

    if (!config.configured) {
      throw new PaypalIdentityError();
    }

    const token = await this.accessToken(config, code);
    const userinfo = new URL(
      '/v1/identity/openidconnect/userinfo',
      config.apiBase,
    );
    userinfo.searchParams.set('schema', 'openid');
    const response = await fetch(userinfo, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new PaypalIdentityError();
    }

    return parsePaypalProfile(await response.json());
  }

  private async accessToken(
    config: ReturnType<typeof readPaypalConfig>,
    code: string,
  ): Promise<string> {
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.returnUrl,
    });
    const response = await fetch(`${config.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${credentials}`,
        'content-type': 'application/x-www-form-urlencoded',
        'paypal-request-id': randomUUID(),
      },
      body,
    });

    if (!response.ok) {
      throw new PaypalIdentityError();
    }

    const payload = (await response.json()) as { access_token?: unknown };

    if (
      typeof payload.access_token !== 'string' ||
      payload.access_token.length === 0
    ) {
      throw new PaypalIdentityError();
    }

    return payload.access_token;
  }
}
