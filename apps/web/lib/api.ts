import { cookies } from 'next/headers';

import type { AuthUser } from '@repo/api';

import { apiBase } from './http';

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = (await cookies()).get('ronda_session')?.value;

  if (!session) {
    return null;
  }

  try {
    const response = await fetch(`${apiBase()}/auth/me`, {
      headers: { cookie: `ronda_session=${session}` },
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
