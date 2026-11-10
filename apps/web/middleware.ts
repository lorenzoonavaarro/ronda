import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'ronda_access_token';
const REFRESH_COOKIE = 'ronda_refresh_token';
const REFRESH_LEEWAY_SECONDS = 60;

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken || !accessToken || !needsRefresh(accessToken)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await refreshSession(refreshToken);

  if (!session) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  setAuthCookies(response, session);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};

function needsRefresh(accessToken: string): boolean {
  const parts = accessToken.split('.');

  if (parts.length !== 3) {
    return true;
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(parts[1] ?? ''),
    ) as { exp?: unknown };

    return (
      typeof payload.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000) + REFRESH_LEEWAY_SECONDS
    );
  } catch {
    return true;
  }
}

async function refreshSession(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const url = firstSet(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const key = firstSet(
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!url || !key) {
    return null;
  }

  try {
    const response = await fetch(
      `${url}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
    };

    if (
      typeof body.access_token !== 'string' ||
      typeof body.refresh_token !== 'string'
    ) {
      return null;
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
    };
  } catch {
    return null;
  }
}

function setAuthCookies(
  response: NextResponse,
  session: { accessToken: string; refreshToken: string },
) {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };

  response.cookies.set(ACCESS_COOKIE, session.accessToken, options);
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, options);
}

function firstSet(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  return atob(padded);
}
