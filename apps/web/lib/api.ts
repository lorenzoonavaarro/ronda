import { cookies } from 'next/headers';

import type { AuthUser, CircleSummary } from '@repo/api';

import { apiBase } from './http';

async function sessionCookie(): Promise<string | null> {
  const session = (await cookies()).get('ronda_session')?.value;

  return session ? `ronda_session=${session}` : null;
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
