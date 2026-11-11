import { auth } from '@clerk/nextjs/server';

import type {
  AuthUser,
  CircleDetail,
  CircleSummary,
  CreditRecord,
  PaypalLinkStatus,
} from '@repo/api';

import { apiBase } from './http';

const tokenCache = new Map<string, { token: string; until: number }>();

async function sessionHeaders(): Promise<HeadersInit | null> {
  const session = await auth();

  if (!session.isAuthenticated) {
    return null;
  }

  const token = await apiSessionToken(session);

  return token ? { Authorization: `Bearer ${token}` } : null;
}

async function apiSessionToken(session: {
  sessionId: string;
  getToken: (options?: { expiresInSeconds?: number }) => Promise<string | null>;
}): Promise<string | null> {
  const cached = tokenCache.get(session.sessionId);
  const now = Date.now();

  if (cached && cached.until > now) {
    return cached.token;
  }

  // The cookie session token can omit a usable party. A short-lived token
  // from this session is the one the API already accepts.
  let minted: string | null = null;

  try {
    minted = await session.getToken({ expiresInSeconds: 60 });
  } catch {
    minted = null;
  }

  const token = minted ?? (await session.getToken());

  if (!token) {
    console.error('Signed-in session has no token for the API.');
    return null;
  }

  tokenCache.set(session.sessionId, { token, until: now + 45_000 });
  return token;
}

export async function requireUser(): Promise<AuthUser> {
  await auth.protect();
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Signed in, but the account record is not available.');
  }

  return user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const headers = await sessionHeaders();

  if (!headers) {
    return null;
  }

  try {
    const response = await fetch(`${apiBase()}/auth/me`, {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Account lookup failed with status ${response.status}.`);
      return null;
    }

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}

export async function getCircles(): Promise<CircleSummary[]> {
  const headers = await sessionHeaders();

  if (!headers) {
    return [];
  }

  const response = await fetch(`${apiBase()}/circles`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not load circles.');
  }

  return (await response.json()) as CircleSummary[];
}

export async function getCircle(id: string): Promise<CircleDetail | null> {
  const headers = await sessionHeaders();

  if (!headers) {
    return null;
  }

  const response = await fetch(`${apiBase()}/circles/${id}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Could not load this circle.');
  }

  return (await response.json()) as CircleDetail;
}

export async function getCredit(): Promise<CreditRecord | null> {
  const headers = await sessionHeaders();

  if (!headers) {
    return null;
  }

  const response = await fetch(`${apiBase()}/credit`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not load the credit score.');
  }

  return (await response.json()) as CreditRecord;
}

export async function getPaypalLink(): Promise<PaypalLinkStatus> {
  const headers = await sessionHeaders();

  if (!headers) {
    throw new Error('Sign in required.');
  }

  const response = await fetch(`${apiBase()}/paypal/account`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not load the PayPal account.');
  }

  return (await response.json()) as PaypalLinkStatus;
}
