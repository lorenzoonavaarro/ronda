import type { IncomingHttpHeaders } from 'node:http';

import { Injectable } from '@nestjs/common';

import { readPaypalConfig } from '../../paypal/domain/paypal-config';
import type { PaypalPayments } from '../application/ports';
import { PaypalPaymentError, PaypalVaultError } from '../domain/errors';

type CachedToken = { value: string; expiresAt: number };

@Injectable()
export class PaypalPaymentsClient implements PaypalPayments {
  private token: CachedToken | null = null;

  async createSetupToken(input: {
    returnUrl: string;
    cancelUrl: string;
    requestId: string;
  }): Promise<{ id: string; approveUrl: string }> {
    const payload = await this.post(
      '/v3/vault/setup-tokens',
      input.requestId,
      {
        payment_source: {
          paypal: {
            description: 'Ronda monthly contribution',
            usage_type: 'MERCHANT',
            experience_context: {
              brand_name: 'Ronda',
              locale: 'en-US',
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      },
      false,
    );
    const id = readString(payload, 'id');
    const approveUrl = readLink(payload, 'approve');

    if (!id || !approveUrl) {
      throw new PaypalVaultError();
    }

    return { id, approveUrl };
  }

  async createPaymentToken(
    setupTokenId: string,
    requestId: string,
  ): Promise<{ paymentTokenId: string; customerId: string | null }> {
    const payload = await this.post(
      '/v3/vault/payment-tokens',
      requestId,
      {
        payment_source: {
          token: { id: setupTokenId, type: 'SETUP_TOKEN' },
        },
      },
      false,
    );
    const paymentTokenId = readString(payload, 'id');

    if (!paymentTokenId) {
      throw new PaypalVaultError();
    }

    const customer = (payload as { customer?: { id?: unknown } }).customer;

    return {
      paymentTokenId,
      customerId:
        customer && typeof customer.id === 'string' ? customer.id : null,
    };
  }

  async createVaultOrder(input: {
    requestId: string;
    vaultId: string;
    amount: string;
    customId: string;
  }): Promise<{ orderId: string }> {
    const payload = await this.post(
      '/v2/checkout/orders',
      input.requestId,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: input.customId,
            invoice_id: input.customId,
            amount: { currency_code: 'USD', value: input.amount },
          },
        ],
        payment_source: { paypal: { vault_id: input.vaultId } },
      },
      true,
    );
    const orderId = readString(payload, 'id');

    if (!orderId) {
      throw new PaypalPaymentError(true);
    }

    return { orderId };
  }

  async verifyWebhook(input: {
    headers: IncomingHttpHeaders;
    event: unknown;
  }): Promise<boolean> {
    const config = readPaypalConfig();
    const webhookId = config.webhookId;

    if (!config.configured || webhookId.length === 0) {
      return false;
    }

    const transmissionId = header(input.headers, 'paypal-transmission-id');
    const transmissionTime = header(input.headers, 'paypal-transmission-time');
    const transmissionSig = header(input.headers, 'paypal-transmission-sig');
    const authAlgo = header(input.headers, 'paypal-auth-algo');
    const certUrl = header(input.headers, 'paypal-cert-url');

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !authAlgo ||
      !paypalCertUrl(certUrl)
    ) {
      return false;
    }

    const accessToken = await this.accessToken();
    const response = await fetch(
      `${config.apiBase}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: input.event,
        }),
      },
    );

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as {
      verification_status?: unknown;
    };

    return payload.verification_status === 'SUCCESS';
  }

  private async post(
    path: string,
    requestId: string,
    body: unknown,
    charge: boolean,
  ): Promise<unknown> {
    const config = readPaypalConfig();

    if (!config.configured) {
      throw charge ? new PaypalPaymentError(false) : new PaypalVaultError();
    }

    let response: Response;

    try {
      response = await fetch(`${config.apiBase}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.accessToken()}`,
          'content-type': 'application/json',
          'paypal-request-id': requestId,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw charge ? new PaypalPaymentError(true) : new PaypalVaultError();
    }

    if (!response.ok) {
      throw charge
        ? new PaypalPaymentError(
            response.status >= 500 || response.status === 429,
          )
        : new PaypalVaultError();
    }

    try {
      return (await response.json()) as unknown;
    } catch {
      throw charge ? new PaypalPaymentError(true) : new PaypalVaultError();
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }

    const config = readPaypalConfig();
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString('base64');
    const response = await fetch(`${config.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${credentials}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new PaypalVaultError();
    }

    const payload = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };

    if (
      typeof payload.access_token !== 'string' ||
      payload.access_token.length === 0
    ) {
      throw new PaypalVaultError();
    }

    const expiresIn =
      typeof payload.expires_in === 'number' ? payload.expires_in : 300;
    this.token = {
      value: payload.access_token,
      expiresAt: Date.now() + Math.max(expiresIn - 60, 30) * 1000,
    };

    return payload.access_token;
  }
}

function readString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readLink(payload: unknown, rel: string): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const links = (payload as { links?: unknown }).links;

  if (!Array.isArray(links)) {
    return null;
  }

  for (const link of links) {
    if (
      link &&
      typeof link === 'object' &&
      (link as { rel?: unknown }).rel === rel &&
      typeof (link as { href?: unknown }).href === 'string'
    ) {
      return (link as { href: string }).href;
    }
  }

  return null;
}

function header(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  const item = Array.isArray(value) ? value[0] : value;

  return typeof item === 'string' ? item : '';
}

function paypalCertUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      (url.hostname === 'api.paypal.com' ||
        url.hostname === 'api.sandbox.paypal.com' ||
        url.hostname === 'api-m.paypal.com' ||
        url.hostname === 'api-m.sandbox.paypal.com')
    );
  } catch {
    return false;
  }
}
