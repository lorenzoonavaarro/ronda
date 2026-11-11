'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

async function clerkToken(getToken: GetToken): Promise<string | null> {
  try {
    return await getToken({ skipCache: true });
  } catch {
    return null;
  }
}

export function useAuthedFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (input: string, init?: RequestInit) => {
      const token = await clerkToken(getToken);
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
      const token = await clerkToken(getToken);
      const url = new URL(path, window.location.href);

      // Loopback cookies are not shared between localhost and 127.0.0.1.
      if (url.hostname === '127.0.0.1') {
        url.hostname = 'localhost';
      }

      if (!token) {
        window.location.assign(url.toString());
        return;
      }

      const form = document.createElement('form');
      const session = document.createElement('input');
      form.method = 'POST';
      form.action = url.toString();
      session.type = 'hidden';
      session.name = 'session';
      session.value = token;
      form.append(session);
      document.body.append(form);
      form.submit();
    },
    [getToken],
  );
}
