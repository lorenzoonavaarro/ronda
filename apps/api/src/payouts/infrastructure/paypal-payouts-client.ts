import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';

import { readPaypalConfig } from '../../paypal/domain/paypal-config';
import type { PaypalPayouts } from '../application/ports';
import { PayoutUnavailableError } from '../domain/errors';

type CachedToken = { value: string; expiresAt: number };

@Injectable()
export class PaypalPayoutsClient implements PaypalPayouts {
  private token: CachedToken | null = null;

  async create(input: {
    requestId: string;
    senderBatchId: string;
    recipientEmail: string;
    amountMinor: number;
  }): Promise<{ batchId: string; itemId: string | null }> {
    const payload = await this.post(
      '/v1/payments/payouts',
      input.requestId,
      {
        sender_batch_header: {
          sender_batch_id: input.senderBatchId,
          email_subject: 'Your Ronda payout is ready',
          email_message: 'Your Ronda savings-circle payout has been sent.',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            receiver: input.recipientEmail,
            amount: {
              value: (input.amountMinor / 100).toFixed(2),
              currency: 'USD',
            },
            note: 'Ronda savings-circle payout',
            sender_item_id: input.senderBatchId,
          },
        ],
      },
    );

    const batch = payload as {
      batch_header?: { payout_batch_id?: unknown };
      items?: Array<{ payout_item_id?: unknown }>;
    };
    const batchId = batch.batch_header?.payout_batch_id;
    const itemId = batch.items?.[0]?.payout_item_id;

    if (typeof batchId !== 'string' || batchId.length === 0) {
      throw new PayoutUnavailableError();
    }

    return {
      batchId,
      itemId: typeof itemId === 'string' ? itemId : null,
    };
  }

  async verifyWebhook(input: {
    headers: IncomingHttpHeaders;
    event: unknown;
  }): Promise<boolean> {
    const config = readPaypalConfig();

    if (!config.configured || !config.webhookId) {
      return false;
    }

    const header = (name: string) => {
      const value = input.headers[name];
      return Array.isArray(value) ? value[0] ?? '' : value ?? '';
    };
    const transmissionId = header('paypal-transmission-id');
    const transmissionTime = header('paypal-transmission-time');
    const transmissionSig = header('paypal-transmission-sig');
    const authAlgo = header('paypal-auth-algo');
    const certUrl = header('paypal-cert-url');

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !authAlgo ||
      !isPaypalCertUrl(certUrl)
    ) {
      return false;
    }

    const response = await fetch(
      `${config.apiBase}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.accessToken()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: config.webhookId,
          webhook_event: input.event,
        }),
      },
    );

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as {
      verification_status?: unknown;
    };
    return body.verification_status === 'SUCCESS';
  }

  private async post(
    path: string,
    requestId: string,
    body: unknown,
  ): Promise<unknown> {
    const config = readPaypalConfig();

    if (!config.configured) {
      throw new PayoutUnavailableError();
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
      throw new PayoutUnavailableError();
    }

    if (!response.ok) {
      throw new PayoutUnavailableError();
    }

    return response.json();
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
      throw new PayoutUnavailableError();
    }

    const payload = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };

    if (typeof payload.access_token !== 'string') {
      throw new PayoutUnavailableError();
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

function isPaypalCertUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      [
        'api.paypal.com',
        'api.sandbox.paypal.com',
        'api-m.paypal.com',
        'api-m.sandbox.paypal.com',
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
