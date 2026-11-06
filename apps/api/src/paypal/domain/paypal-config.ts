export type PaypalConfig = {
  configured: boolean;
  environment: 'sandbox' | 'live';
  clientId: string;
  clientSecret: string;
  returnUrl: string;
  webOrigin: string;
  apiBase: string;
  connectBase: string;
  webhookId: string;
};

const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://uri.paypal.com/services/paypalattributes',
].join(' ');

export function readPaypalConfig(
  env: NodeJS.ProcessEnv = process.env,
): PaypalConfig {
  const clientId = (
    env.PAYPAL_CLIENT_ID ??
    env.PAYPAL_SANDBOX_CLIENT_ID ??
    ''
  ).trim();
  const clientSecret = (
    env.PAYPAL_CLIENT_SECRET ??
    env.PAYPAL_SANDBOX_CLIENT_SECRET ??
    ''
  ).trim();
  const environment = env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
  const live = environment === 'live';

  return {
    configured: clientId.length > 0 && clientSecret.length > 0,
    environment,
    clientId,
    clientSecret,
    returnUrl:
      env.PAYPAL_RETURN_URL?.trim() || 'http://127.0.0.1:3000/paypal/callback',
    webOrigin: env.WEB_ORIGIN?.trim() || 'http://localhost:3001',
    apiBase: live
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com',
    connectBase: live
      ? 'https://www.paypal.com'
      : 'https://www.sandbox.paypal.com',
    webhookId: (env.PAYPAL_WEBHOOK_ID ?? '').trim(),
  };
}

export function buildAuthorizeUrl(input: {
  connectBase: string;
  clientId: string;
  returnUrl: string;
  state: string;
}): string {
  const url = new URL('/connect', input.connectBase);
  url.searchParams.set('flowEntry', 'static');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('redirect_uri', input.returnUrl);
  url.searchParams.set('state', input.state);
  url.searchParams.set('fullPage', 'true');
  return url.toString();
}

export function pageOrigin(hostname: string, configured: string): string {
  const fallback = 'http://localhost:3001';
  const origin = /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured)
    ? configured
    : fallback;

  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return origin;
  }

  const url = new URL(origin);
  url.hostname = 'localhost';
  return url.origin;
}

export function localhostCallbackRedirect(
  hostname: string,
  port: string,
  query: { code?: string; state?: string; error?: string },
): string | null {
  if (hostname !== '127.0.0.1') {
    return null;
  }

  const safePort = /^\d{1,5}$/.test(port) ? port : '3000';
  const url = new URL(`http://localhost:${safePort}/paypal/callback`);

  for (const key of ['code', 'state', 'error'] as const) {
    const value = query[key];

    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
