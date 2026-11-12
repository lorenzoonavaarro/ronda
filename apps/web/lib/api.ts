import { auth } from '@clerk/nextjs/server';

import type {
  ActivityRecord,
  AuthUser,
  CircleDetail,
  CircleRounds,
  CircleSummary,
  CreditRecord,
  PaperAccount,
  PaperMarketQuote,
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

async function refreshSessionHeaders(): Promise<HeadersInit | null> {
  const session = await auth();

  if (!session.isAuthenticated) {
    return null;
  }

  tokenCache.delete(session.sessionId);
  const token = await apiSessionToken(session);

  return token ? { Authorization: `Bearer ${token}` } : null;
}

async function apiFetch(path: string): Promise<Response | null> {
  const headers = await sessionHeaders();

  if (!headers) {
    return null;
  }

  const response = await fetch(`${apiBase()}${path}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSessionHeaders();

  if (!refreshed) {
    return response;
  }

  return fetch(`${apiBase()}${path}`, {
    headers: refreshed,
    cache: 'no-store',
  });
}

async function apiSessionToken(session: {
  sessionId: string;
  getToken: (options?: { expiresInSeconds?: number }) => Promise<string | null>;
}): Promise<string | null> {
  const now = Date.now();
  const cached = tokenCache.get(session.sessionId);

  if (cached && cached.until > now && tokenUsableUntil(cached.token, now)) {
    return cached.token;
  }

  tokenCache.delete(session.sessionId);

  // The cookie session token can omit a usable party. A short-lived token
  // from this session is the one the API already accepts.
  let minted: string | null;

  try {
    minted = await session.getToken({ expiresInSeconds: 60 });
  } catch (error) {
    console.error(
      'Could not mint an API session token.',
      safeReason(error),
    );
    minted = null;
  }

  const token = usableToken(minted, now) ?? usableToken(await session.getToken(), now);

  if (!token) {
    console.error('Signed-in session has no usable token for the API.');
    return null;
  }

  const until = Math.min(now + 45_000, tokenUsableUntil(token, now) ?? now);
  tokenCache.set(session.sessionId, { token, until });
  return token;
}

function usableToken(token: string | null, now: number): string | null {
  if (!token) {
    return null;
  }

  const expiresAt = tokenUsableUntil(token, now);

  if (expiresAt !== null && expiresAt <= now) {
    return null;
  }

  return token;
}

function tokenUsableUntil(token: string, now: number): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(),
    ) as { exp?: unknown };
    const expiresAt =
      typeof payload.exp === 'number' ? payload.exp * 1000 - 10_000 : null;

    return expiresAt !== null && expiresAt > now ? expiresAt : null;
  } catch {
    return null;
  }
}

function safeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown';

  return message
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[token]')
    .slice(0, 180);
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
  try {
    const response = await apiFetch('/auth/me');

    if (!response) {
      return null;
    }

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
  return loadCircles('/circles');
}

export async function getAllCircles(): Promise<CircleSummary[]> {
  return loadCircles('/circles?scope=all');
}

async function loadCircles(path: string): Promise<CircleSummary[]> {
  const response = await apiFetch(path);

  if (!response) {
    return [];
  }

  if (!response.ok) {
    throw new Error('Could not load circles.');
  }

  return (await response.json()) as CircleSummary[];
}

export async function getCircle(id: string): Promise<CircleDetail | null> {
  const response = await apiFetch(`/circles/${id}`);

  if (!response) {
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Could not load this circle.');
  }

  return (await response.json()) as CircleDetail;
}

export async function getActivity(): Promise<ActivityRecord> {
  const response = await apiFetch('/activity');

  if (!response) {
    throw new Error('Sign in required.');
  }

  if (!response.ok) {
    throw new Error('Could not load activity.');
  }

  return (await response.json()) as ActivityRecord;
}

export async function getCircleRounds(id: string): Promise<CircleRounds | null> {
  const response = await apiFetch(`/circles/${id}/rounds`);

  if (!response) {
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Could not load this circle history.');
  }

  return (await response.json()) as CircleRounds;
}

export async function getCredit(): Promise<CreditRecord | null> {
  const response = await apiFetch('/credit');

  if (!response) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Could not load the credit score.');
  }

  return (await response.json()) as CreditRecord;
}

export async function getPaperMarket(): Promise<PaperMarketQuote[]> {
  const response = await apiFetch('/paper/market');

  if (!response) {
    throw new Error('Sign in required.');
  }

  if (!response.ok) {
    throw new Error('Could not load the market.');
  }

  return (await response.json()) as PaperMarketQuote[];
}

export async function getPaperAccount(): Promise<PaperAccount> {
  const response = await apiFetch('/paper');

  if (!response) {
    throw new Error('Sign in required.');
  }

  if (!response.ok) {
    throw new Error('Could not load the paper account.');
  }

  return (await response.json()) as PaperAccount;
}

export async function getPaypalLink(): Promise<PaypalLinkStatus> {
  const response = await apiFetch('/paypal/account');

  if (!response) {
    throw new Error('Sign in required.');
  }

  if (!response.ok) {
    throw new Error('Could not load the PayPal account.');
  }

  return (await response.json()) as PaypalLinkStatus;
}
