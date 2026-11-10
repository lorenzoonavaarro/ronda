import { cookies } from 'next/headers';

import type {
  AuthUser,
  CircleDetail,
  CircleSummary,
  CreditRecord,
  PaypalLinkStatus,
} from '@repo/api';

import { apiBase } from './http';

async function sessionCookie(): Promise<string | null> {
  const session = (await cookies()).get('ronda_access_token')?.value;

  return session ? `ronda_access_token=${session}` : null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookie = await sessionCookie();

  if (!cookie) {
    return null;
  }

  try {
    const response = await fetch(`${apiBase()}/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}

export async function getCircles(): Promise<CircleSummary[]> {
  const cookie = await sessionCookie();

  if (!cookie) {
    return [];
  }

  const response = await fetch(`${apiBase()}/circles`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not load circles.');
  }

  return (await response.json()) as CircleSummary[];
}

export async function getCircle(id: string): Promise<CircleDetail | null> {
  const cookie = await sessionCookie();

  if (!cookie) {
    return null;
  }

  const response = await fetch(`${apiBase()}/circles/${id}`, {
    headers: { cookie },
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
  const cookie = await sessionCookie();

  if (!cookie) {
    return null;
  }

  const response = await fetch(`${apiBase()}/credit`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not load the credit score.');
  }

  return (await response.json()) as CreditRecord;
}

export async function getPaypalLink(): Promise<PaypalLinkStatus> {
  const cookie = await sessionCookie();

  if (!cookie) {
    throw new Error('Sign in required.');
  }

  const response = await fetch(`${apiBase()}/paypal/account`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not load the PayPal account.');
  }

  return (await response.json()) as PaypalLinkStatus;
}
