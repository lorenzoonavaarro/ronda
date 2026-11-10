'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

export const CLERK_SESSION_COOKIE = 'ronda_clerk';

export function useAuthedFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (input: string, init?: RequestInit) => {
      const token = await getToken();
      const headers = new Headers(init?.headers);

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(input, {
        ...init,
        headers,
        credentials: 'include',
      });
    },
    [getToken],
  );
}

export function useOpenApi() {
  const { getToken } = useAuth();

  return useCallback(
    async (path: string) => {
      const token = await getToken();

      if (token) {
        document.cookie = `${CLERK_SESSION_COOKIE}=${token}; Path=/; Max-Age=120; SameSite=Lax`;
      }

      window.location.assign(path);
    },
    [getToken],
  );
}
